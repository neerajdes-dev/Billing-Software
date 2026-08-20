
import base64
import hashlib
import json
import os
import urllib.request
import urllib.error
from cryptography.fernet import Fernet
from fastapi import HTTPException

PROMPT = """Extract this retail/wholesale purchase invoice into JSON only.
Return exactly these keys:
supplier_name, supplier_gstin, supplier_mobile, invoice_number, invoice_date,
items, subtotal, gst_amount, discount_amount, freight_amount, round_off, total_amount.
items must be an array with keys:
item_name, barcode, quantity, purchase_price, mrp, sale_price, gst_percent,
batch_number, manufacturing_date, expiry_date, confidence.
Use null when unavailable. Dates must be YYYY-MM-DD when confidently available.
Do not invent values. confidence is 0 to 1.
"""

def _fernet():
    secret = os.getenv("AI_SETTINGS_SECRET") or os.getenv("DATABASE_URL") or "resolvent-billing-ai"
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest())
    return Fernet(key)

def encrypt_key(value):
    if not value:
        return None
    return _fernet().encrypt(value.encode()).decode()

def decrypt_key(value):
    if not value:
        return ""
    try:
        return _fernet().decrypt(value.encode()).decode()
    except Exception:
        raise HTTPException(status_code=500, detail="Stored AI key cannot be decrypted. Check AI_SETTINGS_SECRET.")

def mask_key(value):
    if not value:
        return ""
    return ("•" * max(4, len(value)-4)) + value[-4:]

def _request(url, payload, headers=None, timeout=90):
    data=json.dumps(payload).encode()
    req=urllib.request.Request(url,data=data,headers={"Content-Type":"application/json",**(headers or {})},method="POST")
    try:
        with urllib.request.urlopen(req,timeout=timeout) as res:
            return json.loads(res.read().decode())
    except urllib.error.HTTPError as e:
        body=e.read().decode(errors="ignore")
        raise HTTPException(status_code=400,detail=f"AI provider error {e.code}: {body[:500]}")
    except Exception as e:
        raise HTTPException(status_code=400,detail=f"Unable to connect to AI provider: {e}")

def _json_from_text(text):
    text=(text or "").strip()
    if text.startswith("```"):
        text=text.strip("`")
        if text.startswith("json"): text=text[4:].strip()
    start=text.find("{"); end=text.rfind("}")
    if start>=0 and end>start: text=text[start:end+1]
    try: return json.loads(text)
    except Exception: raise HTTPException(status_code=422,detail="AI returned invalid JSON. Please retry or use another model.")

def extract_openai(api_key, model, mime, raw):
    b64=base64.b64encode(raw).decode()
    block={"type":"input_file","filename":"purchase.pdf","file_data":f"data:{mime};base64,{b64}"} if mime=="application/pdf" else {"type":"input_image","image_url":f"data:{mime};base64,{b64}"}
    payload={"model":model or "gpt-5-mini","input":[{"role":"user","content":[{"type":"input_text","text":PROMPT},block]}]}
    out=_request("https://api.openai.com/v1/responses",payload,{"Authorization":f"Bearer {api_key}"})
    text="".join(c.get("text","") for o in out.get("output",[]) for c in o.get("content",[]) if c.get("type")=="output_text")
    return _json_from_text(text)

def extract_gemini(api_key, model, mime, raw):
    b64=base64.b64encode(raw).decode()
    payload={"contents":[{"parts":[{"text":PROMPT},{"inline_data":{"mime_type":mime,"data":b64}}]}],
             "generationConfig":{"responseMimeType":"application/json"}}
    out=_request(f"https://generativelanguage.googleapis.com/v1beta/models/{model or 'gemini-2.5-flash'}:generateContent?key={api_key}",payload)
    text=out["candidates"][0]["content"]["parts"][0]["text"]
    return _json_from_text(text)

def extract_claude(api_key, model, mime, raw):
    b64=base64.b64encode(raw).decode()
    media={"type":"document","source":{"type":"base64","media_type":"application/pdf","data":b64}} if mime=="application/pdf" else {"type":"image","source":{"type":"base64","media_type":mime,"data":b64}}
    payload={"model":model or "claude-sonnet-4-5","max_tokens":5000,"messages":[{"role":"user","content":[media,{"type":"text","text":PROMPT}]}]}
    out=_request("https://api.anthropic.com/v1/messages",payload,{"x-api-key":api_key,"anthropic-version":"2023-06-01"})
    return _json_from_text("".join(x.get("text","") for x in out.get("content",[]) if x.get("type")=="text"))

def extract_ollama(base_url, model, mime, raw):
    if mime=="application/pdf":
        raise HTTPException(status_code=400,detail="Ollama local PDF extraction is not enabled in this build. Upload a JPG/PNG bill or use OpenAI/Gemini/Claude.")
    b64=base64.b64encode(raw).decode()
    payload={"model":model or "gemma3","messages":[{"role":"user","content":PROMPT,"images":[b64]}],"format":"json","stream":False}
    out=_request((base_url or "http://127.0.0.1:11434").rstrip("/")+"/api/chat",payload,timeout=180)
    return _json_from_text(out.get("message",{}).get("content",""))

def extract_bill(settings, raw, mime):
    provider=(settings.provider or "").lower()
    key=decrypt_key(settings.encrypted_api_key)
    if provider=="openai": return extract_openai(key,settings.model,mime,raw)
    if provider=="gemini": return extract_gemini(key,settings.model,mime,raw)
    if provider=="claude": return extract_claude(key,settings.model,mime,raw)
    if provider=="ollama": return extract_ollama(settings.base_url,settings.model,mime,raw)
    raise HTTPException(status_code=400,detail="Unsupported AI provider")

def test_provider(settings):
    provider=(settings.provider or "").strip().lower()

    if provider=="ollama":
        out=_request((settings.base_url or "http://127.0.0.1:11434").rstrip("/")+"/api/chat",
            {"model":settings.model or "gemma3","messages":[{"role":"user","content":"Reply with OK only."}],"stream":False},timeout=30)
        return bool(out.get("message"))

    key=decrypt_key(settings.encrypted_api_key)
    if not key:
        raise HTTPException(
            status_code=400,
            detail=f"API key is not configured for {provider.title()}",
        )
    # provider-specific lightweight test uses same public generation APIs
    if provider=="gemini":
        _request(f"https://generativelanguage.googleapis.com/v1beta/models/{settings.model or 'gemini-2.5-flash'}:generateContent?key={key}",
                 {"contents":[{"parts":[{"text":"Reply OK"}]}]})
    elif provider=="claude":
        _request("https://api.anthropic.com/v1/messages",
                 {"model":settings.model or "claude-sonnet-4-5","max_tokens":10,"messages":[{"role":"user","content":"Reply OK"}]},
                 {"x-api-key":key,"anthropic-version":"2023-06-01"})
    elif provider=="openai":
        _request("https://api.openai.com/v1/responses",
                 {"model":settings.model or "gpt-5-mini","input":"Reply OK"},
                 {"Authorization":f"Bearer {key}"})
    else:
        raise HTTPException(status_code=400,detail="Unsupported AI provider")
    return True

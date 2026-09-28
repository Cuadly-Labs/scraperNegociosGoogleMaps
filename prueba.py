import requests
try:
    r = requests.get("http://127.0.0.1:8080/v1/models", timeout=5)
    print("Status:", r.status_code)
    print("Body:", r.text)
except Exception as e:
    print("❌ Error conectando en local:", e)
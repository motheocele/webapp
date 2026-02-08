#!/usr/bin/env bash
set -euo pipefail

# Mints a GitHub App installation token using Azure Key Vault + managed identity.
#
# Required env vars:
#   KV_GITHUB_APPID_SECRET_ID          Key Vault secret *id/url* containing the GitHub App ID (numeric)
#   KV_GITHUB_APP_PRIVATEKEY_SECRET_ID Key Vault secret *id/url* containing the GitHub App private key PEM
#
# Optional:
#   GITHUB_OWNER (default: motheocele)
#   GITHUB_REPO  (default: webapp)

OWNER="${GITHUB_OWNER:-motheocele}"
REPO="${GITHUB_REPO:-webapp}"

: "${KV_GITHUB_APPID_SECRET_ID:?Set KV_GITHUB_APPID_SECRET_ID}"
: "${KV_GITHUB_APP_PRIVATEKEY_SECRET_ID:?Set KV_GITHUB_APP_PRIVATEKEY_SECRET_ID}"

appid="$(az keyvault secret show --id "$KV_GITHUB_APPID_SECRET_ID" --query value -o tsv | tr -d '\r' | tr -d '\n')"
key_pem="$(az keyvault secret show --id "$KV_GITHUB_APP_PRIVATEKEY_SECRET_ID" --query value -o tsv)"

export APPID="$appid"
export KEY_PEM="$key_pem"
export OWNER="$OWNER"
export REPO="$REPO"

python3 - <<'PY'
import base64, json, os, time, urllib.request
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import load_pem_private_key

def b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip('=')

appid = os.environ['APPID']
owner = os.environ['OWNER']
repo = os.environ['REPO']
key_pem_raw = os.environ['KEY_PEM'].strip()
# Azure Key Vault UI/CLI can store PEM with spaces instead of newlines.
if "BEGIN" in key_pem_raw and "END" in key_pem_raw and "\n" not in key_pem_raw:
    # Insert newlines after BEGIN and before END, then turn space-delimited base64 into newline-delimited.
    for begin in ("-----BEGIN RSA PRIVATE KEY-----", "-----BEGIN PRIVATE KEY-----"):
        if begin in key_pem_raw:
            key_pem_raw = key_pem_raw.replace(begin, begin + "\n", 1)
            break
    for end in ("-----END RSA PRIVATE KEY-----", "-----END PRIVATE KEY-----"):
        if end in key_pem_raw:
            key_pem_raw = key_pem_raw.replace(end, "\n" + end + "\n", 1)
            break
    key_pem_raw = key_pem_raw.replace(" ", "\n")
key_pem = key_pem_raw.encode()

now = int(time.time())
header = {"alg":"RS256","typ":"JWT"}
payload = {"iat": now-30, "exp": now+9*60, "iss": appid}
unsigned = f"{b64url(json.dumps(header,separators=(',',':')).encode())}.{b64url(json.dumps(payload,separators=(',',':')).encode())}"

private_key = load_pem_private_key(key_pem, password=None)

sig = private_key.sign(
    unsigned.encode(),
    padding.PKCS1v15(),
    hashes.SHA256(),
)

jwt = unsigned + "." + b64url(sig)

def gh_request(method, url, data=None):
    headers = {
        "Authorization": f"Bearer {jwt}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "openclaw-gh-app-token",
    }
    if data is not None:
        data = json.dumps(data).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())

inst = gh_request("GET", f"https://api.github.com/repos/{owner}/{repo}/installation")
inst_id = inst["id"]

tok = gh_request("POST", f"https://api.github.com/app/installations/{inst_id}/access_tokens", data={"repositories":[repo]})
print(tok["token"], end="")
PY
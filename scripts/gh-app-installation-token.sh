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
import base64, json, os, subprocess, tempfile, time, urllib.request

def b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip('=')

appid = os.environ['APPID']
owner = os.environ['OWNER']
repo = os.environ['REPO']
key_pem = os.environ['KEY_PEM'].encode()

now = int(time.time())
header = {"alg":"RS256","typ":"JWT"}
payload = {"iat": now-30, "exp": now+9*60, "iss": appid}
unsigned = f"{b64url(json.dumps(header,separators=(',',':')).encode())}.{b64url(json.dumps(payload,separators=(',',':')).encode())}"

with tempfile.NamedTemporaryFile('wb', delete=False) as f:
    f.write(key_pem)
    key_path = f.name

try:
    sig = subprocess.check_output(
        ["openssl","dgst","-sha256","-sign",key_path],
        input=unsigned.encode()
    )
finally:
    try:
        os.remove(key_path)
    except OSError:
        pass

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
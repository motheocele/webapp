# GitHub authentication (GitHub App + Azure Key Vault)

This repo can be pushed to/deployed from environments that have:

- Azure CLI logged in via **managed identity** (system-assigned or user-assigned)
- Access to an Azure Key Vault that stores the **GitHub App ID** and **GitHub App private key (PEM)**
- A GitHub App installed on the target org/user/repo with appropriate permissions

## Mint an installation token

Use the helper script:

```bash
export KV_GITHUB_APPID_SECRET_ID="<keyvault-secret-id-or-url>"
export KV_GITHUB_APP_PRIVATEKEY_SECRET_ID="<keyvault-secret-id-or-url>"
export GITHUB_OWNER="motheocele"
export GITHUB_REPO="webapp"

TOKEN="$(./scripts/gh-app-installation-token.sh)"
```

## Use the token for git pushes

```bash
git remote set-url origin "https://x-access-token:${TOKEN}@github.com/${GITHUB_OWNER}/${GITHUB_REPO}.git"
# push as normal
git push
```

Notes:
- Keep the token short-lived; don’t write it to disk.
- Don’t commit Key Vault secret IDs/URLs into the repo.

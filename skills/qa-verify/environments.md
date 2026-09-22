# QA environments — the allowlist

The only environments and hosts `/verify` may use. Usernames of **test accounts** only; **never a password** (passwords live in each person's "SIS QA verify" Chrome profile). QA owns the values; a `TBC` entry cannot be verified on until it is filled.

| Environment | Branch that deploys it | App URL | Keycloak host / realm | Typically run by |
|---|---|---|---|---|
| `base-qa` | `base-qa` | `https://sis.qa.k8.gears-int.com` (TBC with QA) | TBC / TBC | Developers |
| `gcet-qa` | `gcet-qa` | TBC | TBC / TBC | QA |
| `gutech-qa` | `gutech-qa` | TBC | TBC / `gutech` (TBC) | QA |

## Test accounts per role

| Role | `base-qa` | `gcet-qa` | `gutech-qa` |
|---|---|---|---|
| Admin | TBC | TBC | TBC |
| Registrar | TBC | TBC | TBC |
| Faculty / HOD | TBC | TBC | TBC |
| Student | TBC | TBC | TBC |

Add a row for any role a script needs. A script that names a role with no account here stops with INCONCLUSIVE.

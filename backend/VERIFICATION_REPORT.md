# SAFARA Backend Verification Status

## Package verification

- Source tree inspected file-by-file.
- Python source parsed with `ast` successfully.
- Python source compiled successfully before packaging.
- `.env`, `.venv`, `__pycache__`, and `.pyc` files are excluded from the deliverable.
- Schema contains 11 referenced tables.
- Gemini is the configured AI provider.
- The deliverable uses the stable `gemini-2.5-flash-lite` model by default.
- No API key or database password is included in the deliverable.

## Runtime verification limitation

A live MySQL server was not available in the build environment, and outbound package/network access was unavailable. Therefore this report deliberately does **not** claim a fresh live HTTP/MySQL/Gemini test.

Run the following on the target machine before frontend integration:

```bash
pip install -r requirements.txt
# create MySQL database and SOURCE sql/schema.sql
# create .env from .env.example and add the user's Gemini key
python app.py
```

Then test:

```text
GET  /api/v1/
GET  /api/v1/health
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/incidents/classify
POST /api/v1/incidents
PATCH /api/v1/incidents/:id/classification
```

The previous 423/424 report is retained only as historical evidence from the earlier package; its model configuration is obsolete and it must not be treated as the verification result for this package.

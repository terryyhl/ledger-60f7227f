# ledger-60f7227f

## Receipts (encrypted)
Receipt images are published only as ciphertext in `data/r/<random-id>.bin` (AES-256-GCM, same key as `ledger.enc.json`, AAD = id).
The id ↔ entry mapping exists only inside `ledger.enc.json`. Plaintext images, `data/*.json` and the local manifest are gitignored.
记账管家 produces them (instead of `encrypt_data.py`) from `/workspace/bookkeeping`:

    LEDGER_PASSWORD=… python3 encrypt_receipts.py /workspace/ledger-app/data        # add --dry-run to only count

Attachment paths are read from `ledger/*.csv` (column `attachment`, relative to `--root` or absolute; missing/unreadable files are skipped with a warning, `--strict` exits 3). Entries sharing an image get the same receipt ids.
HEIC (iPhone camera) needs `pip install pillow-heif`. Source paths/filenames are removed before encryption (`ledger.enc.json` carries only receipt ids; `encrypt_data.py` strips them too).
It strips EXIF/GPS, writes a 1600 px WebP and a 240 px thumbnail per receipt, skips unchanged images (local manifest), deletes stale ciphertext,
then re-encrypts the ledger and subscriptions. Commit `data/ledger.enc.json`, `data/subscriptions.enc.json`, `data/merchants.enc.json` (from `bookkeeping/merchants.json`, optional) and `data/r/*.bin`.

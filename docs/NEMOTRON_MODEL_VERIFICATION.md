# Nemotron 3.5 Embed 8B — verification report

Status: **official documentation verified AND live OpenRouter API verified**.
Date: 2026-11-26.
The capability verification in this report used 3 requests only: text `passage`, text `query`, and combined text+image `passage`. A later integration run used 3 more requests (two text passages and one text query); no other live requests were made. This report itself does not cover deployment.

## Authorized model

- OpenRouter ID: `nvidia/nemotron-3.5-embed-8b:free`
- Canonical slug: `nvidia/nemotron-3.5-embed-8b-20261021`
- Provider: NVIDIA (single provider route; no fallback provider)
- Category: multimodal embedding model, `text+image -> embeddings`
- This is the only model authorized for this work. The previous model and all other embedding models remain excluded.

## Verified from official sources

### Availability and free route

- The model page exists at OpenRouter and lists `nvidia/nemotron-3.5-embed-8b:free` as **Free**.
- The embeddings model catalog returns the exact ID with `pricing.prompt = "0"` and `pricing.completion = "0"`.
- The endpoints API reports one endpoint: `Nvidia | nvidia/nemotron-3.5-embed-8b-20261021:free`, provider `Nvidia`, quantization `bf16`, context length `32768`.
- OpenRouter states this model is **not currently available through EU in-region routing**.

### Endpoint and response format

- OpenRouter embeddings endpoint: `POST https://openrouter.ai/api/v1/embeddings`.
- Native NVIDIA endpoint: `POST https://integrate.api.nvidia.com/v1/embeddings`.
- OpenRouter request fields include `model`, `input`, optional `input_type`, optional `dimensions`, optional `encoding_format`, and optional `provider`.
- OpenRouter response shape: `object: "list"`, `data: [{ object: "embedding", index, embedding, document_index? }]`, `model`, and `usage`.

### Asymmetric retrieval rules (NVIDIA official API reference)

- `input_type` is required for this model.
- Allowed values: `passage` for indexing/documents and `query` for searching.
- Inputs containing an image **must** use `passage`.
- Queries are text-only.
- Documents may be text, one image, or text plus one image.
- Direct image-to-image similarity is **not** authorized or documented here.
- Arabic is included in NVIDIA's evaluated text and image retrieval languages.

### Image, truncation, and dimension rules

- Images must be PNG or JPEG and sent as base64 data URLs such as `data:image/jpeg;base64,...` (or an `<img src="data:image/...;base64,...">` tag in the native API).
- One image per input item.
- NVIDIA API reference: maximum `10240` tokens per input for this endpoint; `truncate` accepts `END` (default) or `NONE`; `START` is unsupported.
- `longest_edge` accepts `256` through `1540`, default `1120`; use the same value for indexing and querying.
- `dimensions` may be `1` through `4096`; omitting it returns native output. Shortened vectors are L2-normalized again.
- Native output is **4096 dimensions**; an NVIDIA NIM support-matrix footnote with `2048` is ambiguous and was resolved by the live response below.

### OpenRouter free-tier limits

Official OpenRouter limits documentation:

| Credits purchased (all time) | Requests/minute | Requests/day |
| --- | --- | --- |
| Less than 10 | 20 | 50 |
| At least 10 | 20 | 1000 |

Free-model requests are tracked by `GET /api/v1/key` in `data.free_model_daily_requests`. `429` responses may include `X-RateLimit-*` and `Retry-After` headers. Extra API keys or accounts do not raise the limits.

### Privacy restriction

The OpenRouter free endpoint page states that confidential information and personal data (including voices or faces) must not be uploaded, and that use is logged for security and service improvement. Real lost/found images may contain faces or personal data; production use with such images requires an explicit privacy/consent decision. The live test used a synthetic solid-colour PNG with no personal data.

## Live API capability verification (3 requests)

All three calls returned HTTP 200, `model: nvidia/nemotron-3.5-embed-8b`, one embedding, **4096** values, all finite:

| Test | `input_type` | Payload shape | Prompt tokens |
| --- | --- | --- | --- |
| Text document | `passage` | plain string | 13 |
| Text query | `query` | plain string | 8 |
| Text + image document | `passage` | `input: [{ content: [{type:'text'},{type:'image_url',image_url:{url:'data:image/png;base64,...'}}] }]` | 120 |

This resolves the earlier unknowns:

1. OpenRouter accepts `input_type: "passage"` / `"query"` for this route.
2. OpenRouter accepts the documented multimodal `content` array and converts it for NVIDIA.
3. Native returned length is exactly 4096; no truncation is needed for the pgvector column.
4. A PNG data URL is accepted; a 256x256 synthetic PNG used 120 tokens.
5. The key in use is a free-model key; quota is governed by the table above.

## Environment notes

- `frontend/.env.local` targets the authorized backend `gtbvqmuuyidmdhgmwsjv` (value not printed here). The OpenRouter key was placed there temporarily for live verification and has since been removed.
- The Supabase MCP connection now targets `gtbvqmuuyidmdhgmwsjv`. The earlier `uvtektqsgthsjrezqlln` project was unrelated and is no longer connected.
- The OpenRouter key is now stored as the Supabase Vault secret `OPENROUTER_API_KEY`, read by the function through the service-role-only RPC `get_openrouter_api_key`. It must not be restored to a frontend env file. Because it was exposed in chat, it should be rotated and the Vault secret updated.

## Sources

- https://openrouter.ai/models/nvidia/nemotron-3.5-embed-8b:free
- https://openrouter.ai/api/v1/embeddings/models
- https://openrouter.ai/api/v1/models/nvidia/nemotron-3.5-embed-8b:free/endpoints
- https://openrouter.ai/docs/api/api-reference/embeddings/submit-an-embedding-request
- https://openrouter.ai/docs/api_reference/embeddings
- https://openrouter.ai/docs/api-reference/limits
- https://build.nvidia.com/nvidia/nemotron-3_5-embed-8b/modelcard
- https://build.nvidia.com/nvidia/nemotron-3_5-embed-8b/apireference
- https://docs.nvidia.com/nim/nemo-retriever/embedding/latest/use-the-api-openai.html
- https://docs.nvidia.com/nim/nemo-retriever/embedding/latest/support-matrix.html

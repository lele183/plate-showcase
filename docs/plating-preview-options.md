# Plating Studio preview evaluation

Checked October 18, 2026. Prices, quotas, and availability must be checked again before launch.

## Recommended approach

Generate a transparent food layer once per uploaded dish and reuse it on the real dinnerware photographs. Swapping collections, placement, portion, or tabletop should not invoke a model. The existing upload-scoped cache already supports this approach. Full-scene image generation can change product geometry, glaze, and patterns and would require a separate render for each variation.

Start with the Qwen Image 2.1 Turbo hosted API and measure a small set of real dishes before choosing a production provider. Request one 1024-pixel image, keep the daily quotas, and avoid automatic paid fallback. Higher-resolution or Pro generations should be a deliberate upgrade after the cheaper model has been evaluated.

The rendered sample also shows a visual limit: a transparent food layer can still look like a pasted cutout because it does not generate contact shadows or integrate the lighting on a particular plate. If photographic realism is the primary acceptance criterion, evaluate a separate full-scene image-editing pass using the composed scene as its reference. Such a pass can alter the product, so keep the accurate catalog composition available and label the generated scene as illustrative. This full-scene path has not been implemented or benchmarked in this change.

## Cost and free options

| Option                                    | Cost / measured speed                                                                                                                                                                         | Suitable use                                                        |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Qwen Image 2.1 Turbo, DashScope Singapore | Official model listing: USD 0.016 per generated image, or USD 16 per 1,000. Official provider latency was not measured here.                                                                  | Candidate for the website after real dish-editing evaluation.       |
| Public Hugging Face Qwen Image 2.1 demo   | The anonymous text-to-image test succeeded without an API key or payment in 19 seconds. Shared capacity and queues vary.                                                                      | Free evaluation; do not make production availability depend on it.  |
| Alibaba Cloud trial quotas                | Some official regional pricing pages list a 10-image, 90-day trial for Qwen 2.1; the Turbo model console can show no free quota. Check the actual account, region, and model before invoking. | An account-specific trial, not a guaranteed free service.           |
| Local Qwen Image 2.1                      | No per-image API bill; GPU, power, deployment, and licensing still apply. No local inference benchmark was performed.                                                                         | Research evaluation after checking memory and license requirements. |
| Existing starter food library             | No generation cost when displayed; instant cached assets.                                                                                                                                     | General examples, not previews of a customer's actual dish.         |

At the Singapore Turbo list price, the existing 50-images-per-day site limit corresponds to USD 0.80 in generation charges for 50 newly generated images. Storage and traffic are separate. Reusing a cached food layer does not generate another image.

## Online test performed

The public `akhaliq/Qwen-Image-2.1-workflow` Space exposes a Gradio `rewritten_prompt` API. A text prompt requested a top-down salmon portion, asparagus, lemon, and dill with no plate or table and a real transparent background.

- The request succeeded on October 18, 2026.
- The downloaded output was a 1024 x 1024 PNG with a real, nonconstant alpha channel.
- Total request, queue, generation, and download time was approximately 19 seconds.
- The report and image are in `.cache/qwen-evaluation/report.json` and `.cache/qwen-evaluation/salmon-online.png`. Subsequent script runs write `salmon-online.json`.
- `.cache/qwen-evaluation/qwen-plate-preview.png` renders the same generated food layer on the Mars MR-710 and Legna LE-106 catalog cutouts. No plate was regenerated, and this local composition triggered no additional model call.
- The result demonstrates text-to-image output, not preservation of a real uploaded dish or official Turbo API quality/latency.
- The local-source-photo upload was blocked by automatic approval review because explicit authorization to send that asset to the third-party demo had not been established. No source photo was uploaded.

Reproduce the text-only test:

```sh
node scripts/try-qwen-demo.mjs
```

The optional `--image` mode uploads the named local file to that public Space. Use it only after the owner explicitly authorizes that file and destination. Never use a customer's private photo for a public demo test.

## Local hardware and license

This machine reports an NVIDIA GeForce RTX 4070 with 12,282 MiB of GPU memory and approximately 48 GiB of system memory. The official Qwen Image 2.1 model card describes a 7B visual-generation component and a BF16 quick start. Those visual weights alone require roughly 14 GB before the text encoder, VAE, or activation buffers, so a local setup would need quantization and/or CPU offloading. That is a feasibility inference, not a measured speed claim. The model card documents CPU offloading. Neither a large model download nor a local inference environment was installed for this evaluation.

The released Qwen Image 2.1 weights use the Qwen Research License. Commercial usage requires a separate license under the published terms. A local commercial deployment therefore cannot be assumed to be free. Hosted API terms and downloadable-weight terms should be assessed separately.

## Implementation prepared

`src/lib/food-preview.ts` implements the documented synchronous Qwen API and OpenAI multipart image editing. Qwen supports the `qwen-image-2.1-turbo` and `qwen-image-2.1-pro` model names. Qwen uses the prompt to select transparent output; an undocumented OpenAI-style `background` parameter is not sent to Qwen.

For workspace-scoped keys, copy the console's HTTPS API origin into `DASHSCOPE_API_HOST`. Only official regional DashScope origins and workspace `maas.aliyuncs.com` origins are accepted. Existing keys can use `DASHSCOPE_REGION` and the legacy regional endpoints.

The default OpenAI model is `gpt-image-1.5`. GPT Image 2 remains configurable; the current OpenAI reference marks transparent backgrounds on GPT Image 2 as preview support. Missing credentials are the confirmed reason generation was disabled in the local configuration, not proof of a model incompatibility.

Results are checked for a nonempty alpha channel. The server rejects opaque or completely empty results, limits downloads to 20 MiB and decoded images to 40 million pixels, accepts only HTTPS Alibaba result URLs without redirects, and does not forward the API credential when downloading a result.

No paid provider was invoked, no credentials were added, no model weights were installed, and no production deployment was performed.

## Primary sources

- [Official Qwen Image 2.1 repository](https://github.com/QwenLM/Qwen-Image-2.1)
- [Official model card and CPU-offload example](https://huggingface.co/Qwen/Qwen-Image-2.1)
- [Qwen Research License for the weights](https://huggingface.co/Qwen/Qwen-Image-2.1/blob/main/LICENSE)
- [Alibaba Qwen generation/editing guide, including transparent subject extraction](https://help.aliyun.com/zh/model-studio/qwen-image-edit-guide)
- [DashScope native API reference](https://help.aliyun.com/zh/model-studio/qwen-image-api)
- [Qwen Image 2.1 Turbo model listing and regional price](https://modelstudio.console.alibabacloud.com/models/qwen-image-2.1-turbo)
- [Alibaba regional model pricing and trial terms](https://www.alibabacloud.com/help/es/model-studio/model-pricing)
- [Public Hugging Face demo](https://huggingface.co/spaces/akhaliq/Qwen-Image-2.1-workflow)
- [OpenAI image edit API reference](https://developers.openai.com/api/reference/resources/images/methods/edit)

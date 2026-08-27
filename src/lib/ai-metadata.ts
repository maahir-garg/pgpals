const SCAN_BYTES_PER_EDGE = 1024 * 1024;

const AI_METADATA_SIGNATURES: { label: string; pattern: RegExp }[] = [
  { label: "Midjourney", pattern: /midjourney/ },
  {
    label: "OpenAI image generator",
    pattern: /dall[\s._-]*e|gpt[\s._-]*image|openai[\s._-]*image/,
  },
  {
    label: "Stable Diffusion",
    pattern:
      /stable[\s._-]*diffusion|automatic1111|invokeai|fooocus|novelai|dreamstudio|k[\s._-]*sampler|negative prompt[\s\S]{0,200}(sampler|cfg scale|steps)/,
  },
  {
    label: "ComfyUI",
    pattern: /comfyui|["']class_type["']\s*:\s*["'](?:ksampler|checkpointloader)/,
  },
  { label: "Adobe Firefly", pattern: /adobe[\s._-]*firefly|firefly[\s._-]*generated/ },
  {
    label: "AI image generator",
    pattern:
      /leonardo[.]?ai|ideogram[.]?ai|google[\s._-]*imagen|image[\s._-]*playground|canva[\s._-]*magic[\s._-]*media/,
  },
  {
    label: "AI-generated media",
    pattern:
      /ai[\s._-]*generated|generated[\s._-]*(?:by|with)[\s._-]*(?:ai|artificial intelligence)|generative[\s._-]*ai/,
  },
];

async function readMetadataSample(file: File): Promise<string> {
  const slices =
    file.size <= SCAN_BYTES_PER_EDGE * 2
      ? [file]
      : [
          file.slice(0, SCAN_BYTES_PER_EDGE),
          file.slice(file.size - SCAN_BYTES_PER_EDGE),
        ];
  const decoder = new TextDecoder("latin1");
  const decoded = await Promise.all(
    slices.map(async (slice) => decoder.decode(await slice.arrayBuffer()))
  );

  // Removing null bytes also exposes common UTF-16 metadata labels to the
  // deliberately simple ASCII signature scan.
  return `${file.name}\n${decoded.join("\n")}`.replaceAll("\0", "").toLowerCase();
}

// This is an intentionally lightweight deterrent, not a content classifier.
// It checks the original file before image compression can strip metadata.
export async function findAiMetadata(file: File): Promise<string | null> {
  const sample = await readMetadataSample(file);
  return (
    AI_METADATA_SIGNATURES.find(({ pattern }) => pattern.test(sample))?.label ??
    null
  );
}

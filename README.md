# image-gen

Generate AI images from prompt lists using Google Gemini.

## Setup

```bash
npm install
cp .env.example .env
# Add your Gemini API key and optionally change the model in .env
```

## Usage

```bash
npx tsx generate.ts <project> [limit]
```

- `project` — name of a folder under `projects/`
- `limit` — optional, max number of images to generate in one run

## Project structure

```
projects/
└── my-project/
    ├── input/
    │   └── prompts.json
    └── output/          ← generated images go here
```

To create a new project, make a folder under `projects/` with an `input/prompts.json` file. The `output/` folder is created automatically.

## Prompts format

```json
[
  {
    "code": "IMG-001",
    "product": "Living Room",
    "prompt": "Professional photo of a bright modern living room..."
  }
]
```

- `code` — unique ID, used as the output filename
- `product` — human-readable label (logged during generation)
- `prompt` — the image generation prompt

## Examples

```bash
# Generate all images for a project
npx tsx generate.ts hearts

# Generate only the next 3
npx tsx generate.ts sitting-room 3
```

Progress is tracked in `projects/<name>/progress.json` so interrupted runs can be resumed.

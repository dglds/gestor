default: run

# Abre o app em modo desenvolvimento
run:
    pnpm tauri dev

# Compila o executável/pacote de produção
build:
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ "$(uname -s)" == "Linux" ]] && ! command -v rpmbuild >/dev/null && ! command -v dpkg >/dev/null; then
        pnpm tauri build --no-bundle
    else
        pnpm tauri build
    fi

# Valida TypeScript, Rust e testes unitários
check:
    pnpm tsc --noEmit
    cargo check --manifest-path src-tauri/Cargo.toml
    cargo test --manifest-path src-tauri/Cargo.toml

# Sobe uma nova versão no GitHub (ex: just release 1.0, just release 1.1, just release 2.0)
release version:
    #!/usr/bin/env bash
    set -euo pipefail

    RAW="{{version}}"
    CLEAN="${RAW#v}"
    if [[ ! "$CLEAN" =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?$ ]]; then
        echo "Versão inválida: '$RAW'. Use formato simples como 1.0, 1.1 ou 2.0." >&2
        exit 1
    fi

    IFS='.' read -r MAJOR MINOR PATCH <<< "$CLEAN"
    PATCH="${PATCH:-0}"
    SEMVER="${MAJOR}.${MINOR}.${PATCH}"
    if [[ "$PATCH" == "0" ]]; then
        SIMPLE="${MAJOR}.${MINOR}"
    else
        SIMPLE="${MAJOR}.${MINOR}.${PATCH}"
    fi
    TAG="v${SIMPLE}"

    if [[ -n "$(git status --porcelain)" ]]; then
        echo "Existem alterações não commitadas. Faça commit antes de gerar o release." >&2
        exit 1
    fi

    if git rev-parse "$TAG" >/dev/null 2>&1; then
        echo "A tag '$TAG' já existe localmente." >&2
        exit 1
    fi

    node -e '
      const fs = require("fs");
      const semver = process.argv[1];
      for (const file of ["package.json", "src-tauri/tauri.conf.json"]) {
        const data = JSON.parse(fs.readFileSync(file, "utf8"));
        data.version = semver;
        fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
      }
      const cargoPath = "src-tauri/Cargo.toml";
      const cargo = fs.readFileSync(cargoPath, "utf8");
      const updated = cargo.replace(/^version = ".*"$/m, `version = "${semver}"`);
      fs.writeFileSync(cargoPath, updated);
    ' "$SEMVER"

    pnpm tsc --noEmit
    cargo test --manifest-path src-tauri/Cargo.toml

    git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
    if ! git diff --cached --quiet; then
        git commit -m "release: $TAG"
    fi

    git tag -a "$TAG" -m "Gestor $TAG"
    git push origin HEAD "$TAG"

    echo ""
    echo "Release $TAG enviado para o GitHub!"
    echo "Build automático: https://github.com/dglds/gestor/actions"
    echo "Página de download: https://github.com/dglds/gestor/releases/tag/$TAG"

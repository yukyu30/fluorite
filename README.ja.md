# fluorite

[English](./README.md) · **日本語**

Markdown の **フロントマター** を、読みやすくチェーンできる DSL で検査・検証
します。**ライブラリ** としても **CLI** としても使えます。

```md
---
tags: ["ok", "ng"]
title: "これはタイトルです"
---
```

```ts
import { check } from "@yukyu30/fluorite";

const result = check(markdown, (fm) => {
  fm.key("title").required().type("string").lengthMin(10);
  fm.key("tags").not.has("ng"); // ← "ng" があるので失敗（赤）
});

result.ok; // false
result.failures; // [{ key: "tags", rule: "has", negated: true, ok: false, ... }]
```

チェックは例外を投げません。各ルールは**結果オブジェクト**（成否とその理由）を
返すので、まとめて赤／緑でレポートできます。

## インストール

**Node.js 18 以上** が必要です。パッケージは ESM と CommonJS の両ビルドと
TypeScript 型定義を同梱しています。

```sh
# 開発依存として — CI / pre-commit での lint 用途で一般的
npm install -D @yukyu30/fluorite

# 実行時依存として — ライブラリを実行時に呼び出す場合
npm install @yukyu30/fluorite
```

他のパッケージマネージャ:

```sh
pnpm add -D @yukyu30/fluorite
yarn add -D @yukyu30/fluorite
```

インストールせずに CLI を実行:

```sh
npx @yukyu30/fluorite check "docs/**/*.md"
```

## ユースケース

fluorite が実際に使われる場面ごとのレシピです。ここで使うマッチャの詳細は
[ライブラリ API](#ライブラリ-api) を参照してください。

### 1. CI でブログ / ドキュメントのフロントマターを lint する

すべての記事のフロントマターを一貫させ、ズレたらビルドを失敗させます。ルールを
設定ファイルに置き、`fluorite check` をパイプラインに組み込みます。

```js
// fluorite.config.mjs
import { defineConfig } from "@yukyu30/fluorite";

export default defineConfig({
  include: ["content/**/*.md"],
  exclude: ["**/drafts/**"],
  rules: (fm) => {
    fm.key("title").required().type("string").lengthMin(10).lengthMax(70);
    fm.key("date").required().matches(/^\d{4}-\d{2}-\d{2}$/);
    fm.key("description").required().lengthMin(50).lengthMax(160); // SEO に有効
    fm.key("draft").type("boolean");
  },
});
```

```jsonc
// package.json
{
  "scripts": {
    "lint:content": "fluorite check"
  }
}
```

```yaml
# .github/workflows/content.yml
- run: npm ci
- run: npm run lint:content # 失敗があれば exit 1 → CI が赤に
```

### 2. タグの誤記を検出し、語彙を固定する

タグはすぐにブレます（`Blog` と `blog`、紛れ込んだ `ng`）。正規の集合を固定
すれば、fluorite が問題の値を正確に名指しします。あるいは表記ルールだけを
強制することもできます。

```js
const TAGS = ["release", "blog", "news", "guide"];

export default defineConfig({
  rules: (fm) => {
    fm.key("tags").required().type("array").subsetOf(TAGS);
    // tags: ["blog", "New", "ng"]
    // → all items should be one of [...] (invalid: ["New","ng"])
  },
});

// …リストを保守したくなければ、小文字のケバブケースだけを要求してもよい:
fm.key("tags").each.matches(/^[a-z0-9-]+$/);
```

### 3. 条件付きルールで公開ワークフローを強制する

ルールセットはただの関数で、`fm.data` はパース済みのフロントマターです。記事が
公開状態になったときだけ、より厳しいルールを適用できます。

```js
export default defineConfig({
  rules: (fm) => {
    fm.key("status").required().oneOf(["draft", "review", "published"]);

    if (fm.data.status === "published") {
      fm.key("date").required().matches(/^\d{4}-\d{2}-\d{2}$/);
      fm.key("author").required().type("string");
      fm.key("description").required().lengthMin(50);
      fm.key("tags").not.has("wip"); // 作業中タグのまま公開させない
    }
  },
});
```

### 4. 識別子・スラッグ・日付をパターンで検証する

```js
fm.key("slug").required().matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/); // ケバブケース
fm.key("date").required().matches(/^\d{4}-\d{2}-\d{2}$/); // ISO 日付
fm.key("version").matches(/^\d+\.\d+\.\d+$/); // semver
```

### 5. プログラムからフロントマターをチェックする（SSG / ビルドスクリプト）

サイトを生成するときや独自のレポートが欲しいときは、ライブラリを直接使います。
`check` は例外を投げず、収集できる結果を返します。

```ts
import { readFile } from "node:fs/promises";
import { glob } from "tinyglobby";
import { check } from "@yukyu30/fluorite";

const failed: string[] = [];
for (const file of await glob("content/**/*.md")) {
  const result = check(await readFile(file, "utf8"), (fm) => {
    fm.key("title").required().lengthMin(10);
    fm.key("tags").type("array").subsetOf(["blog", "news"]);
  });

  if (!result.ok) {
    failed.push(file);
    for (const f of result.failures) {
      console.error(`${file} → ${f.key}: ${f.message}`);
    }
  }
}
if (failed.length) process.exit(1);
```

### 6. Markdown 以外のデータを検証する（CMS / API のペイロード）

すでにオブジェクトをパース済みなら、Markdown のステップを飛ばして `checkData`
を使えます。ヘッドレス CMS や API、YAML/JSON ローダー由来のコンテンツに便利です。

```ts
import { checkData } from "@yukyu30/fluorite";

const entry = await cms.getEntry("home"); // { title, tags, ... }
const result = checkData(entry, (fm) => {
  fm.key("title").required().type("string");
  fm.key("tags").subsetOf(["featured", "evergreen"]);
});
```

### 7. 取り込み前に不正なフロントマターをブロックする（pre-commit）

```jsonc
// package.json — lint-staged + husky の場合
{
  "lint-staged": {
    "content/**/*.md": "fluorite check"
  }
}
```

## ライブラリ API

### `check(source, rules) => CheckResult`

Markdown 文字列 `source` からフロントマターを取り出し、`rules` コールバックを
実行します。引数 `fm` はレコーダーで、呼んだマッチャごとに結果が 1 件記録されます。

```ts
const result = check(source, (fm) => {
  fm.key("title").required().lengthMin(10);
});
```

`CheckResult`:

| フィールド  | 説明                                       |
| ---------- | ------------------------------------------ |
| `ok`       | すべてのルールが通れば `true`               |
| `results`  | 記録されたすべての `RuleResult`（順序どおり）|
| `failures` | 失敗した `RuleResult` のみ                  |
| `data`     | パース済みのフロントマターオブジェクト       |

フロントマターブロックが無い、または YAML が壊れている場合は、例外ではなく失敗
扱いの `parse` ルールとして記録されます。

### `checkData(data, rules) => CheckResult`

`check` と同じですが、すでにパース済みのフロントマターオブジェクトに対して
実行します。

### マッチャ

`fm.key("name")` でチェーンを始めます。`.not` 修飾子は**次のマッチャだけ**を
否定し、その後リセットされます。

**存在 / 型**

- `required()` / `exists()` — キーが存在する
- `type(t)` — `"string" | "number" | "boolean" | "array" | "object" | "null"`

**値**

- `eq(value)` — 深い等価比較
- `oneOf([...])` — 許可された集合のいずれか（enum）
- `matches(regexp)` — 文字列がパターンに一致

**包含（配列・文字列）**

- `has(value)` — 配列が要素を含む、または文字列が部分文字列を含む
- `hasAll([...])` — すべての項目を含む
- `hasAny([...])` — 少なくとも 1 つを含む

**enum / 配列の中身** — タグ表記のブレを検出

- `subsetOf([...])` / `only([...])` — 値が配列で、その全要素が許可集合に含まれる。
  失敗時は問題の（誤記の）値を列挙
- `each.oneOf([...])` — `subsetOf` と同じことを、要素ごとのアクセサ経由で
- `each.type(t)` — すべての要素が型 `t`
- `each.matches(regexp)` — すべての（文字列）要素がパターンに一致

**長さ（配列・文字列）**

- `length(n)` — 長さが `n` と等しい
- `lengthMin(n)` — 長さ `>= n`
- `lengthMax(n)` — 長さ `<= n`

```ts
check(source, (fm) => {
  fm.key("status").oneOf(["draft", "published"]);
  fm.key("slug").matches(/^[a-z0-9-]+$/);
  fm.key("tags").type("array").hasAll(["blog"]).not.has("ng");
  fm.key("summary").lengthMin(20).lengthMax(160);
});
```

### タグの enum を定義する

タグはすぐにブレます（`Blog` と `blog`、紛れ込んだ `ng`）。正規の語彙を一度
定義すれば、`subsetOf` がその外にあるものを検出し、失敗メッセージが問題の値を
正確に名指しします。

```ts
const TAGS = ["ok", "release", "blog", "news"];

check(source, (fm) => {
  fm.key("tags").type("array").subsetOf(TAGS);
});
// tags: ["ok", "Blog", "ng"]
// → all items should be one of [...] (invalid: ["Blog","ng"])

// 固定リストの代わりに表記ルールを強制することもできる:
check(source, (fm) => {
  fm.key("tags").each.matches(/^[a-z0-9-]+$/); // 小文字のケバブケースのみ
});
```

## CLI

```sh
fluorite check "docs/**/*.md" [--config <path>] [--quiet]
```

- glob でファイルを集め、各ファイルのフロントマターをチェックし、赤／緑のレポート
  を表示します。いずれかのファイルが失敗すると終了コード `1` で終わります（CI に最適）。
- ルールは設定ファイル（`fluorite.config.{js,mjs,cjs}` または `--config`）から
  読み込みます。

```
✘ docs/bad.md
  ✘ title: length should be >= 10 (was 2) (value: "短い")
  ✘ tags: should not have "ng" (value: ["ok","ng"])
✔ docs/good.md

2 files, 1 passed, 1 failed, 2 rule failures
```

オプション:

- `-c, --config <path>` — 設定ファイルのパス
- `-q, --quiet` — 失敗のあるファイルのみ表示
- `-h, --help` — ヘルプを表示

### 設定ファイル

```js
// fluorite.config.mjs
import { defineConfig } from "@yukyu30/fluorite";

export default defineConfig({
  include: ["docs/**/*.md"],
  exclude: ["**/node_modules/**"],
  rules: (fm) => {
    fm.key("title").required().type("string").lengthMin(10);
    fm.key("tags").required().type("array").not.has("ng");
  },
});
```

CLI の位置引数パターンは `include` を上書きします。どちらも指定しない場合は
`**/*.md` が使われます。

## 開発

```sh
npm test          # テストスイートを実行（vitest）
npm run coverage  # カバレッジ付きで実行（v8）
npm run typecheck # tsc --noEmit
npm run build     # tsup で dist/ にバンドル
```

テストは、マッチャ DSL（すべてのマッチャ、`.not` 形、`each.*` アクセサ）、
フロントマターのパース、`check` / `checkData` の集計結果、設定の読み込み、
レポート整形、そして CLI（プロセス内および、ビルド済みの `dist/cli.js` を実際に
起動する end-to-end）をカバーしています。

## リリース

リリースは [tagpr](https://github.com/Songmu/tagpr) と `npm publish`
（`.github/workflows/tagpr.yml`）で自動化されています。

1. `main` にコミットを push します。tagpr が **Release PR** を作成／更新し、
   `package.json` のバージョンと `CHANGELOG.md` を更新します。
2. Release PR に `minor` / `major` ラベルを付けてバンプを制御します（既定: patch）。
3. Release PR をマージすると、tagpr が `vX.Y.Z` タグと GitHub Release を作成し、
   同じワークフロー実行が npm へパッケージを公開します。

公開には npm の **trusted publishing (OIDC)** を使用します。`NPM_TOKEN`
シークレットは不要で、provenance（来歴）が自動的に添付されます。

初回のみのセットアップ:

1. **最初の公開**（trusted publisher を紐付ける前にパッケージが存在している
   必要があります）。手元のマシンから:
   ```sh
   npm login
   npm publish --access public
   ```
2. GitHub → リポジトリの **Settings → Environments → New environment** で
   `release` という名前の環境を作成します。必要なら保護ルール（例: 必須
   レビュアー）を追加し、公開を手動承認待ちにできます。`publish` ジョブは
   この環境で実行されます。
3. npmjs.com → 対象パッケージ → **Settings → Trusted Publisher → GitHub
   Actions** で次を設定します:
   - Organization or user: `yukyu30`
   - Repository: `fluorite`
   - Workflow filename: `tagpr.yml`
   - Environment: `release` *(手順 2 と一致させる)*
4. GitHub → Settings → Actions → General で "Allow GitHub Actions to create
   and approve pull requests" を有効化します（tagpr 用）。

これ以降、マージされた Release PR ごとにトークン無しで自動公開されます。
`tagpr` ジョブは `main` への push ごとに Release PR を維持します。`release`
環境でゲートされるのは別の `publish` ジョブだけなので、保護ルールは公開だけに
適用されます。

## ライセンス

MIT

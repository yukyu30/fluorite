# fluorite

[English](./README.md) · **日本語**

[![npm](https://img.shields.io/npm/v/@yukyu30/fluorite.svg)](https://www.npmjs.com/package/@yukyu30/fluorite)
[![node](https://img.shields.io/node/v/@yukyu30/fluorite.svg)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/@yukyu30/fluorite.svg)](./LICENSE)

> Markdown の **フロントマター** を、読みやすいチェーン記法で検証する。
> **ライブラリ** としても **CLI** としても使えます。

fluorite は、Markdown 冒頭の YAML フロントマターをチェックするツールです。
「必要なキーがあるか」「型は正しいか」「パターンに合っているか」「決めた語彙の
範囲に収まっているか」——こうしたルールを一度書けば、ファイルごとに合否
（赤／緑）を表示し、ひとつでも崩れていれば終了コード `1` で終わります。
**CI** や **pre-commit** での運用にぴったりです。

```md
---
title: "fluorite ではじめる"
date: 2026-06-07
tags: ["guide", "release"]
---
```

```ts
import { check } from "@yukyu30/fluorite";

const result = check(markdown, (fm) => {
  fm.key("title").required().type("string").lengthMin(10);
  fm.key("date").required().isoDate();
  fm.key("tags").type("array").subsetOf(["guide", "release", "news"]);
});

result.ok;       // true / false
result.failures; // 通らなかったルール。それぞれに分かりやすい理由が付く
```

## なぜ fluorite か

- **そのまま読めるルール。** `fm.key("title").required().type("string").lengthMin(10)`
  ——ルールがそのまま仕様書になります。
- **例外を投げない。** マッチャは合否を「結果」として記録するだけ。YAML が壊れて
  いても、フロントマターが無くても、クラッシュではなく「失敗」として扱われるので、
  常にまとめて集計・レポートできます。
- **クォート無しの日付も文字列のまま。** YAML は `date: 2026-06-07` を `Date`
  に変換してしまい、どう書かれていたかが消えます。fluorite はそのまま文字列で
  保持するので、すべての値をクォートし直さなくても `YYYY-MM-DD` 形式を検証
  できます（[なぜ重要か](#日付は文字列のまま)）。
- **ひとつのツール、ふたつの入口。** 同じルールを、ライブラリ（SSG / ビルド
  スクリプト）でも CLI（CI / pre-commit）でも動かせます。
- **すぐ使える。** ESM と CommonJS の両方を TypeScript 型付きで同梱。Node.js 18+、
  依存は 4 つだけ、初期設定なしで始められます。

## 目次

- [インストール](#インストール)
- [クイックスタート](#クイックスタート)
- [基本の考え方](#基本の考え方)
- [マッチャ一覧](#マッチャ一覧)
- [日付は文字列のまま](#日付は文字列のまま)
- [レシピ集](#レシピ集)
- [CLI](#cli)
- [API](#api)
- [開発](#開発)
- [リリース](#リリース)

## インストール

**Node.js 18 以上** が必要です。ESM と CommonJS の両ビルドと TypeScript 型定義を
同梱しています。

```sh
npm install -D @yukyu30/fluorite   # 開発依存 — CI / pre-commit で lint するなら通常こちら
npm install    @yukyu30/fluorite   # 実行時依存 — ビルド時にライブラリを呼ぶ場合
```

```sh
pnpm add -D @yukyu30/fluorite
yarn add -D @yukyu30/fluorite
```

インストールせずに CLI を試すこともできます。

```sh
npx @yukyu30/fluorite check "docs/**/*.md"
```

## クイックスタート

合うほうの入口を選んでください。どちらも同じルールセットを動かします。

### CLI として使う

1. ルールを設定ファイルに書きます。

   ```js
   // fluorite.config.mjs
   import { defineConfig } from "@yukyu30/fluorite";

   export default defineConfig({
     include: ["docs/**/*.md"],
     rules: (fm) => {
       fm.key("title").required().type("string").lengthMin(10);
       fm.key("date").required().isoDate();
       fm.key("tags").required().type("array");
     },
   });
   ```

2. 実行します。

   ```sh
   npx fluorite check
   ```

   ```
   ✘ docs/draft.md
     ✘ title: length should be >= 10 (was 5) (value: "Hello")
   ✔ docs/intro.md

   2 files, 1 passed, 1 failed, 1 rule failures
   ```

ひとつでも失敗すると終了コード `1` で終わるので、CI への組み込みは一行で済みます。
オプションや設定の詳細は [CLI](#cli) を参照してください。

### ライブラリとして使う

```ts
import { check } from "@yukyu30/fluorite";

const result = check(markdownSource, (fm) => {
  fm.key("title").required().lengthMin(10);
  fm.key("tags").not.has("draft");
});

if (!result.ok) {
  for (const f of result.failures) console.error(`${f.key}: ${f.message}`);
}
```

`check` は例外を投げません。`result.ok` / `result.failures` を見て、好きな形で
レポートできます。全 API は [API](#api) を参照してください。

## 基本の考え方

ルールセットは、`fm`（レコーダー）を受け取ってキーにマッチャを呼ぶだけの関数
です。**マッチャは結果をひとつ記録するだけで、例外は投げません。** `check` は
それらをまとめて `CheckResult` にして返します。

| フィールド  | 説明                                       |
| ---------- | ------------------------------------------ |
| `ok`       | すべてのルールが通れば `true`               |
| `results`  | 記録されたすべての結果（呼んだ順）           |
| `failures` | 失敗した結果だけ                            |
| `data`     | パース済みのフロントマターオブジェクト       |

個々の結果（`RuleResult`）は、対象の `key`、マッチャ名 `rule`、合否の `ok`、
読みやすい `message`、実際の `value` を持ちます。フロントマターが無い場合や
YAML が壊れている場合は、`parse` ルールの失敗として記録されます——壊れた
ファイルはレポート上の赤い一行になるだけで、スタックトレースにはなりません。

## マッチャ一覧

`fm.key("name")` でチェーンを始め、マッチャをつなげます。`.not` は**次のひとつ
だけ**を否定し、その後リセットされます。

```ts
fm.key("tags").type("array").hasAll(["blog"]).not.has("ng");
```

**存在・型**

| マッチャ                   | 通る条件                                                                                            |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| `required()` / `exists()` | キーが存在する                                                                                      |
| `type(t)`                 | 値の型が `t`——`"string" \| "number" \| "boolean" \| "array" \| "object" \| "null" \| "date"` |

**値**

| マッチャ          | 通る条件                                                                                |
| ---------------- | --------------------------------------------------------------------------------------- |
| `eq(value)`      | `value` と深く等しい                                                                     |
| `oneOf([...])`   | 許可した集合のいずれか（enum）                                                            |
| `matches(re)`    | 文字列がパターンに一致                                                                    |
| `isoDate()`      | 実在する `YYYY-MM-DD` の日付（時刻付きや `2026-02-30` のような不正な日付は弾く）           |

**包含**（配列・文字列）

| マッチャ          | 通る条件                                               |
| ---------------- | ----------------------------------------------------- |
| `has(v)`         | 配列が要素を含む／文字列が部分文字列を含む               |
| `hasAll([...])`  | すべての項目を含む                                      |
| `hasAny([...])`  | 少なくともひとつを含む                                  |

**配列の中身** — タグや enum の語彙を保つ

| マッチャ                          | 通る条件                                                          |
| -------------------------------- | --------------------------------------------------------------- |
| `subsetOf([...])` / `only([...])` | 配列の全要素が許可集合に含まれる。失敗時は問題の値を列挙          |
| `each.oneOf([...])`              | 同じ判定を、要素ごとのアクセサ経由で                              |
| `each.type(t)`                   | すべての要素が型 `t`                                            |
| `each.matches(re)`               | すべての（文字列）要素がパターンに一致                            |
| `each.isoDate()`                 | すべての要素が `YYYY-MM-DD` の日付                              |

**長さ**（配列・文字列）

| マッチャ         | 通る条件               |
| --------------- | --------------------- |
| `length(n)`     | 長さが `n` と等しい     |
| `lengthMin(n)`  | 長さが `n` 以上         |
| `lengthMax(n)`  | 長さが `n` 以下         |

```ts
check(source, (fm) => {
  fm.key("status").oneOf(["draft", "published"]);
  fm.key("slug").matches(/^[a-z0-9-]+$/);
  fm.key("date").isoDate();
  fm.key("tags").type("array").subsetOf(["blog", "news"]).not.has("wip");
  fm.key("summary").lengthMin(20).lengthMax(160);
});
```

## 日付は文字列のまま

これは、多くのフロントマター linter が取りこぼすポイントです。

YAML 1.1 は、クォート無しの `date: 2026-06-07` を JavaScript の `Date` に変換
します。すると**どう書かれていたかが消えてしまい**、きれいな `YYYY-MM-DD` も、
時刻付きの値も、タイプミスさえも、すべて同じ `Date` オブジェクトに潰れます。
見えなくなった形式は検証しようがありません——すべてのファイルの、すべての日付を
クォートしてまわるなら別ですが。

fluorite はタイムスタンプ型を含まないスキーマでパースするので、**日付は書かれた
ままの文字列として残ります**。そのため `isoDate()`（あるいは単なる
`matches(/^\d{4}-\d{2}-\d{2}$/)`）で、書かれた形式をそのまま検証できます。
クォートは不要です。

```ts
fm.key("date").required().isoDate();
```

```
2026-06-07           → ok
2026-06-07 10:30:00  → 失敗 — 時刻が付いている
2026-6-7             → 失敗 — ゼロ埋めされていない
2026-02-30           → 失敗 — 実在しない日付
```

真偽値・数値・`null` はこれまでどおりパースされます。文字列のまま残るのは日付
だけです。

## レシピ集

そのままコピーして使える実例です。マッチャの語彙は [マッチャ一覧](#マッチャ一覧)
にまとまっています。

### CI でブログ / ドキュメントを lint する

すべての記事を一貫させ、崩れたらビルドを失敗させます。ルールを設定ファイルに
置き、パイプラインから `fluorite check` を呼びます。

```js
// fluorite.config.mjs
import { defineConfig } from "@yukyu30/fluorite";

export default defineConfig({
  include: ["content/**/*.md"],
  exclude: ["**/drafts/**"],
  rules: (fm) => {
    fm.key("title").required().type("string").lengthMin(10).lengthMax(70);
    fm.key("date").required().isoDate();
    fm.key("description").required().lengthMin(50).lengthMax(160); // SEO に有効
    fm.key("draft").type("boolean");
  },
});
```

```yaml
# .github/workflows/content.yml
- run: npm ci
- run: npx fluorite check   # 失敗があれば exit 1 → CI が赤に
```

### タグの誤記を検出し、語彙を固定する

タグはすぐにブレます（`Blog` と `blog`、紛れ込んだ `ng`）。正規の集合を固定
すれば、fluorite が問題の値を名指しします。リストを保守したくなければ、表記
ルールだけを強制することもできます。

```js
const TAGS = ["release", "blog", "news", "guide"];

fm.key("tags").required().type("array").subsetOf(TAGS);
// tags: ["blog", "New", "ng"]
// → all items should be one of [...] (invalid: ["New","ng"])

// …リストを持ちたくなければ、小文字のケバブケースだけを要求する:
fm.key("tags").each.matches(/^[a-z0-9-]+$/);
```

### 公開後だけルールを厳しくする

ルールセットはただの関数で、`fm.data` はパース済みのフロントマターです。だから
条件によってルールを切り替えられます。

```js
export default defineConfig({
  rules: (fm) => {
    fm.key("status").required().oneOf(["draft", "review", "published"]);

    if (fm.data.status === "published") {
      fm.key("date").required().isoDate();
      fm.key("author").required().type("string");
      fm.key("description").required().lengthMin(50);
      fm.key("tags").not.has("wip"); // 作業中タグのまま公開させない
    }
  },
});
```

### スラッグ・バージョン・日付をパターンで検証する

```js
fm.key("slug").required().matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/); // ケバブケース
fm.key("version").matches(/^\d+\.\d+\.\d+$/);                    // semver
fm.key("date").required().isoDate();                            // YYYY-MM-DD
```

### ビルドスクリプトの中でチェックする

サイト生成時や独自レポートが欲しいときは、ライブラリを直接使います。`check` は
例外を投げないので、複数ファイルの結果を自分で集計できます。

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
    for (const f of result.failures) console.error(`${file} → ${f.key}: ${f.message}`);
  }
}
if (failed.length) process.exit(1);
```

### Markdown 以外のデータを検証する（CMS / API）

すでにオブジェクトをパース済みなら、Markdown のステップを飛ばして `checkData`
を使えます。ヘッドレス CMS、API のレスポンス、YAML / JSON ローダー由来の
データに便利です。

```ts
import { checkData } from "@yukyu30/fluorite";

const entry = await cms.getEntry("home"); // { title, tags, ... }
const result = checkData(entry, (fm) => {
  fm.key("title").required().type("string");
  fm.key("tags").subsetOf(["featured", "evergreen"]);
});
```

### 取り込み前にブロックする（pre-commit）

```jsonc
// package.json — lint-staged + husky の場合
{
  "lint-staged": {
    "content/**/*.md": "fluorite check"
  }
}
```

## CLI

```sh
fluorite check [patterns...] [options]
```

glob でファイルを集め、各ファイルのフロントマターを設定のルールでチェックし、
赤／緑のレポートを表示します。ひとつでも失敗すると終了コード `1` で終わります。

```
✘ docs/bad.md
  ✘ title: length should be >= 10 (was 2) (value: "短い")
  ✘ tags: should not have "ng" (value: ["ok","ng"])
✔ docs/good.md

2 files, 1 passed, 1 failed, 2 rule failures
```

**オプション**

- `-c, --config <path>` — 設定ファイルのパス
  （既定: `fluorite.config.{js,mjs,cjs}`）
- `-q, --quiet` — 失敗のあるファイルだけ表示
- `-h, --help` — ヘルプを表示

**設定ファイル**

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

CLI の位置引数は `include` を上書きします。どちらも指定しなければ `**/*.md` が、
`exclude` の既定は `**/node_modules/**` が使われます。

## API

### `check(source, rules) => CheckResult`

Markdown 文字列 `source` からフロントマターを取り出し、`rules` を実行します。
`CheckResult` の中身は [基本の考え方](#基本の考え方) を参照してください。
フロントマターが無い、または YAML が壊れている場合は、例外ではなく `parse`
ルールの失敗として記録されます。

### `checkData(data, rules) => CheckResult`

`check` と同じですが、すでにパース済みのオブジェクトに対して実行します
（Markdown のステップなし）。

### `defineConfig(config) => FluoriteConfig`

設定ファイルに型推論を効かせるためのヘルパーです。`config` は
`{ include?, exclude?, rules }` です。

### そのほかのエクスポート

応用向けに、`parseFrontmatter`、`loadConfig`、`resolveConfigPath`、
`formatReports`、`Recorder` / `KeyAssertion` / `EachAssertion` クラス、そして
`CheckResult`・`RuleResult`・`RulesFn`・`FluoriteConfig`・`ValueType` の各型も
公開しています。

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
起動する end-to-end）までカバーしています。

## リリース

リリースは [tagpr](https://github.com/Songmu/tagpr) と `npm publish`
（`.github/workflows/tagpr.yml`）で自動化されています。

1. `main` にコミットを push します。tagpr が **Release PR** を作成／更新し、
   `package.json` のバージョンと `CHANGELOG.md` を更新します。
2. Release PR に `minor` / `major` ラベルを付けてバンプを制御します（既定: patch）。
3. Release PR をマージすると、tagpr が `vX.Y.Z` タグと GitHub Release を作成し、
   同じワークフロー実行が npm へ公開します。

公開には npm の **trusted publishing (OIDC)** を使います。`NPM_TOKEN`
シークレットは不要で、provenance（来歴）が自動で添付されます。

<details>
<summary>初回のみのセットアップ</summary>

1. **最初の公開**（trusted publisher を紐付ける前に、パッケージが存在している
   必要があります）。手元のマシンから:
   ```sh
   npm login
   npm publish --access public
   ```
2. GitHub → リポジトリの **Settings → Environments → New environment** で
   `release` という環境を作成します。必要なら保護ルール（例: 必須レビュアー）を
   追加して、公開を手動承認待ちにできます。`publish` ジョブはこの環境で動きます。
3. npmjs.com → 対象パッケージ → **Settings → Trusted Publisher → GitHub
   Actions** で次を設定します:
   - Organization or user: `yukyu30`
   - Repository: `fluorite`
   - Workflow filename: `tagpr.yml`
   - Environment: `release` _(手順 2 と一致させる)_
4. GitHub → Settings → Actions → General で "Allow GitHub Actions to create and
   approve pull requests" を有効化します（tagpr 用）。

これ以降、マージされた Release PR ごとにトークン無しで自動公開されます。`tagpr`
ジョブは `main` への push ごとに Release PR を維持し、`release` 環境でゲート
されるのは別の `publish` ジョブだけなので、保護ルールは公開だけに適用されます。

</details>

## ライセンス

MIT

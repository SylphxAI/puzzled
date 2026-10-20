# Native-speaker review of the ja, es and pt-BR copy

The machine checks (`bun run verify:locale`, the message-catalogue guards) prove
that no raw key reaches a page and that each locale resolves every key. They
cannot prove the copy reads naturally to a player. This file is that record.

## What was reviewed

The player-facing namespaces of the three full locales added by the locales work
(`ja`, `es`, `pt-BR`): home, navigation and footer, pricing, the game catalogue and
game shells, daily and archive, settings, stats, support, the legal pages and the
ja `/tokushoho` page. The zh-HK, zh-TW and zh-CN catalogues were already reviewed
with their own copy work.

## Status

| Locale | Copy source | Native-speaker review |
| --- | --- | --- |
| ja | `src/messages/ja` | **open** - a native speaker has not yet signed off; the copy is the reviewer's draft |
| es | `src/messages/es` | **open** - a native speaker has not yet signed off; the copy is the reviewer's draft |
| pt-BR | `src/messages/pt-BR` | **open** - a native speaker has not yet signed off; the copy is the reviewer's draft |

## How a review is recorded

A native speaker of the locale reads the listed surfaces on the live site, page by
page, and for each locale records below: the reviewer's name, the date (UTC), and
every line they change, as `key: old -> new` with the file it lives in. A locale
counts as reviewed only when its row above says so and its lines are listed here;
a later change to a reviewed locale's copy reopens that locale's row.

## Review log

_No review recorded yet._

## Why this is stated plainly

The outcome of this work is verified copy, not verified machinery. A passing key
sweep with copy that a native speaker would not write is not done, so this record
stays open until the reviews land rather than claiming them.

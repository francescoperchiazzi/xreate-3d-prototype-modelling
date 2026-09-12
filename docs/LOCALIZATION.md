# Localization

XReate exposes 31 selectable interface languages. Interface labels, help text,
and accessible names are updated when a language is selected.

## Coverage contract

Every visible interface string must resolve in the chosen locale or in the
English fallback. Run:

```sh
npm run test:i18n
```

The check is included in `npm run test:smoke`. It protects the header, editor
fragments, modal markup, and new Doodle/About copy from silently showing raw
translation keys.

## Translation provenance

Translations in this prototype were drafted or expanded with AI assistance and
then integrated by the project author. They are a practical accessibility
layer, not certified professional translations. The interface and About panel
state this clearly; native-speaker review is required before a production or
public-institution release. When a localized string is not yet available, the
application deliberately falls back to English instead of displaying a key or
an empty control.

## Adding copy

1. Add the visible string and its English fallback.
2. Add reviewed locale strings where available; do not overwrite a reviewed
   translation with an English fallback.
3. Run `npm run test:i18n` and the smoke suite.

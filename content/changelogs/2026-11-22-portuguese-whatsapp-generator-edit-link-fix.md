---
date: 2026-11-22T20:00:00
version: 2.17.0
title: The WhatsApp link generator in Portuguese, an edit link fix and a short question for paid plans
shortDesc: The free WhatsApp link generator in Brazilian Portuguese, a fix for Brazilian numbers with area code 55, the edit link dialog keeping what you typed while geo rules load, and an optional "How did you find iShortn?" prompt for paid accounts
category: new
---

The WhatsApp link generator now has a Portuguese version, the edit link dialog no longer drops your changes, and paid accounts may see a short question about how they found iShortn.

## WhatsApp link generator in Portuguese

The free WhatsApp link generator is now available in Brazilian Portuguese at [/gerador-de-link-whatsapp](/gerador-de-link-whatsapp). It works the same way as the [English version](/whatsapp-link-generator): type a number and an optional message to get a `wa.me` link and a QR code, all in your browser and without an account.

- **Brazil first.** Brazil (+55) is selected unless your browser's language points to another country, and country names are listed in Portuguese.
- **Portuguese throughout.** Labels, quick-fill messages, errors and the FAQ are in Portuguese. The iShortn dashboard is still in English, and the page says so.
- **Switch languages.** The English page links to the Portuguese one with **Em português**, and the Portuguese page links back with **In English**.

### Brazilian numbers with area code 55

55 is Brazil's country code and also an area code in Rio Grande do Sul. With Brazil selected, a number such as `(55) 99123-4567` was read as already including the country code, which gave a wrong link. Numbers with 10 or 11 digits are now treated as national and get `+55` added, so that number becomes `+5555991234567`. A number with 12 or 13 digits that starts with 55 is still read as already including the country code. This applies to both the English and Portuguese pages.

## Edit link dialog keeps your edits

When you opened **Edit** on a link, its geo rules loaded a moment later. If you had already typed or pasted a new destination by then, the form was reset to the saved values, so saving could keep the old URL. Your edits are now kept, and only the geo rules field fills in when the rules load. Closing and reopening the dialog still starts from the saved link.

## "How did you find iShortn?" for paid plans

Paid accounts may see a short, optional form with two questions: how you first heard about iShortn (with an optional **Where exactly?** field), and what you will mainly use it for. Only the first question is required to submit.

- **When it shows.** It opens after checkout, once your paid plan is active, and as a card above your links on the dashboard until you answer it.
- **Not now.** **Not now** hides the dashboard card for 14 days. After two dismissals, on the dashboard or after checkout, it doesn't show again.
- **Already answered.** If you already filled in the longer feedback survey, which asks the same question, you won't be asked again.
- **Free accounts** never see it.

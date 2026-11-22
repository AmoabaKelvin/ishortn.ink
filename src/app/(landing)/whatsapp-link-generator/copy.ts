import type { PhoneError, PhoneNote } from "./utils";

export type WhatsAppToolLocale = "en" | "pt-BR";

export type WhatsAppToolCopy = {
  phoneLabel: string;
  countryCodeLabel: string;
  includesCountryCodeOption: string;
  countryPlaceholder: string;
  phonePlaceholder: string;
  phoneHint: string;
  opensChatWith: string;
  errors: Record<PhoneError, string>;
  notes: {
    dial_already_included: (dial: string) => string;
    argentina_mobile: string;
  };
  messageLabel: string;
  messageOptional: string;
  quickFillLegend: string;
  // A text ending in a space is an opener: the tool puts the caret after it to finish typing.
  quickFills: { label: string; text: string }[];
  messagePlaceholder: string;
  messageHint: string;
  characters: (count: string) => string;
  messageTooLong: string;
  outputLabel: string;
  shareLinkLabel: string;
  outputEmpty: string;
  outputTooLong: string;
  copyLink: string;
  copied: string;
  openInWhatsApp: string;
  opensInNewTab: string;
  copyFallback: string;
  previewLabel: string;
  qrCodeFor: (link: string) => string;
  qrPlaceholder: string;
  downloadPng: string;
  downloadSvg: string;
  pngFileName: string;
  svgFileName: string;
  scanHint: string;
  denseCodeWarning: string;
  upgradeHeading: string;
  upgradeBody: (linksPerMonth: number, qrCodes: number) => string;
  shortenSignedOut: string;
  shortenSignedIn: string;
  // The Pro line reads `${before}<Link>${link}</Link>${after}`.
  pro: { before: string; link: string; after: string };
  // Shown under the Pro line on pages whose language differs from the (English) dashboard.
  dashboardNote: string | null;
};

const en: WhatsAppToolCopy = {
  phoneLabel: "WhatsApp number",
  countryCodeLabel: "Country code",
  includesCountryCodeOption: "Number includes country code",
  countryPlaceholder: "Country",
  phonePlaceholder: "7700 900123",
  phoneHint: "Type the number the way you'd dial it. We remove spaces, dashes and the leading 0.",
  opensChatWith: "Link opens a chat with",
  errors: {
    too_short: "That number looks too short. Check the country code and number.",
    too_long: "That number is too long. International numbers have at most 15 digits.",
    invalid_chars: "Use digits only, like +44 7700 900123.",
    no_country: "Choose a country or start the number with +.",
  },
  notes: {
    dial_already_included: (dial) =>
      `This number already starts with +${dial}, so we didn't add it again.`,
    argentina_mobile: "WhatsApp numbers for Argentine mobiles usually start with +54 9.",
  },
  messageLabel: "Message",
  messageOptional: "(optional)",
  quickFillLegend: "Quick fill",
  quickFills: [
    { label: "Order", text: "Hi! I'd like to place an order." },
    { label: "Booking", text: "Hi! I'd like to book a table for 2 on Friday at 7pm." },
    { label: "Question", text: "Hi! I have a question about " },
    { label: "Quote", text: "Hi! Could you send me a quote for " },
  ],
  messagePlaceholder: "Hi! I'd like to place an order.",
  messageHint: "People see this typed in when the chat opens. They can edit it before sending.",
  characters: (count) => `${count} characters`,
  messageTooLong: "Your message is too long for a link. Keep it under about 600 characters.",
  outputLabel: "Your WhatsApp link",
  shareLinkLabel: "Share link: people choose who to send your message to",
  outputEmpty: "Add your WhatsApp number to see your link.",
  outputTooLong: "Shorten your message to see your link.",
  copyLink: "Copy link",
  copied: "Copied",
  openInWhatsApp: "Open in WhatsApp",
  opensInNewTab: " (opens in a new tab)",
  copyFallback: "Press Ctrl+C or ⌘C to copy",
  previewLabel: "What they'll see",
  qrCodeFor: (link) => `QR code for ${link}`,
  qrPlaceholder: "Your QR code appears here",
  downloadPng: "Download PNG",
  downloadSvg: "Download SVG",
  pngFileName: "whatsapp-qr-code.png",
  svgFileName: "whatsapp-qr-code.svg",
  scanHint:
    "Scan it with your phone's camera. WhatsApp's in-app scanner only reads WhatsApp's own codes.",
  denseCodeWarning:
    "Long messages make a dense code that's harder to scan from a distance. Shorten the link to keep the code simple.",
  upgradeHeading: "Printing it? Make it a code you can change",
  upgradeBody: (linksPerMonth, qrCodes) =>
    `This code has your number and message built in. If your number changes, every printed code still opens the old chat, and you can't see how many people scan or tap it. Shorten it with iShortn to get a short link and a dynamic QR code you can point somewhere new at any time, with clicks by day, country and device. Free accounts get ${linksPerMonth} links a month and ${qrCodes} dynamic QR codes.`,
  shortenSignedOut: "Shorten and track this link, free",
  shortenSignedIn: "Shorten this link",
  pro: { before: "On ", link: "Pro", after: ", use your own domain, like chat.yourshop.com." },
  dashboardNote: null,
};

const ptBR: WhatsAppToolCopy = {
  phoneLabel: "Número do WhatsApp",
  countryCodeLabel: "Código do país",
  includesCountryCodeOption: "O número já tem o código do país",
  countryPlaceholder: "País",
  phonePlaceholder: "(11) 91234-5678",
  phoneHint:
    "Digite com DDD, do jeito que você discaria. A gente tira espaços, traços, parênteses e o 0 do começo.",
  opensChatWith: "O link abre uma conversa com",
  errors: {
    too_short: "Esse número parece curto demais. Confira o código do país, o DDD e o número.",
    too_long: "Esse número é longo demais. Números internacionais têm no máximo 15 dígitos.",
    invalid_chars: "Use só números, como (11) 91234-5678.",
    no_country: "Escolha um país ou comece o número com +.",
  },
  notes: {
    dial_already_included: (dial) =>
      `Esse número já começa com +${dial}, então não adicionamos de novo.`,
    argentina_mobile: "Celulares da Argentina no WhatsApp normalmente começam com +54 9.",
  },
  messageLabel: "Mensagem",
  messageOptional: "(opcional)",
  quickFillLegend: "Mensagens prontas",
  quickFills: [
    { label: "Pedido", text: "Olá! Quero fazer um pedido." },
    { label: "Agendamento", text: "Olá! Quero agendar um horário." },
    { label: "Dúvida", text: "Olá! Tenho uma dúvida sobre " },
    { label: "Orçamento", text: "Olá! Pode me passar um orçamento de " },
  ],
  messagePlaceholder: "Olá! Quero fazer um pedido.",
  messageHint:
    "A pessoa vê essa mensagem já escrita quando a conversa abre e pode mudar o texto antes de enviar.",
  characters: (count) => `${count} caracteres`,
  messageTooLong:
    "Sua mensagem ficou longa demais para um link. Use menos de 600 caracteres, mais ou menos.",
  outputLabel: "Seu link do WhatsApp",
  shareLinkLabel: "Link para compartilhar: a pessoa escolhe para quem enviar sua mensagem",
  outputEmpty: "Adicione seu número do WhatsApp para ver o link.",
  outputTooLong: "Encurte sua mensagem para ver o link.",
  copyLink: "Copiar link",
  copied: "Copiado",
  openInWhatsApp: "Abrir no WhatsApp",
  opensInNewTab: " (abre em uma nova aba)",
  copyFallback: "Pressione Ctrl+C ou ⌘C para copiar",
  previewLabel: "O que a pessoa vai ver",
  qrCodeFor: (link) => `QR code de ${link}`,
  qrPlaceholder: "Seu QR code aparece aqui",
  downloadPng: "Baixar PNG",
  downloadSvg: "Baixar SVG",
  pngFileName: "qr-code-whatsapp.png",
  svgFileName: "qr-code-whatsapp.svg",
  scanHint:
    "Escaneie com a câmera do celular. O leitor dentro do WhatsApp só lê os códigos do próprio WhatsApp.",
  denseCodeWarning:
    "Mensagens longas geram um código denso, mais difícil de ler de longe. Encurte o link para deixar o código mais simples.",
  upgradeHeading: "Vai imprimir? Use um código que você pode mudar depois",
  upgradeBody: (linksPerMonth, qrCodes) =>
    `Este código tem seu número e sua mensagem gravados nele. Se o número mudar, todo código impresso continua abrindo a conversa antiga, e você não sabe quantas pessoas escanearam ou tocaram. Encurte com o iShortn e ganhe um link curto e um QR code dinâmico que você aponta para outro destino quando quiser, com cliques por dia, país e aparelho. A conta grátis tem ${linksPerMonth} links por mês e ${qrCodes} QR codes dinâmicos.`,
  shortenSignedOut: "Encurtar e acompanhar este link, grátis",
  shortenSignedIn: "Encurtar este link",
  pro: {
    before: "No ",
    link: "Pro",
    after: ", use seu próprio domínio, como chat.sualoja.com.br.",
  },
  dashboardNote:
    "O painel do iShortn é em inglês. Seu link já chega preenchido no formulário: é só clicar em Create Link.",
};

export const whatsappToolCopy = {
  en,
  "pt-BR": ptBR,
} satisfies Record<WhatsAppToolLocale, WhatsAppToolCopy>;

export const phoneNoteText = (copy: WhatsAppToolCopy, note: PhoneNote): string =>
  note.code === "dial_already_included"
    ? copy.notes.dial_already_included(note.dial)
    : copy.notes.argentina_mobile;

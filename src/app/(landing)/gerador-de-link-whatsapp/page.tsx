import {
  IconBasketFilled,
  IconBulbFilled,
  IconChartAreaLineFilled,
  IconEditFilled,
  IconLinkFilled,
  IconMessageCircleFilled,
  IconQrcode,
  IconSparklesFilled,
  IconToolsKitchen2Filled,
  IconUserFilled,
  IconWorldFilled,
} from "@tabler/icons-react";
import { Link } from "next-view-transitions";

import { JsonLd } from "@/components/seo/json-ld";
import { FREE_QR_CODE_LIMIT } from "@/lib/billing/entitlements";
import { PLAN_CAPS } from "@/lib/billing/plans";
import {
  createBreadcrumbSchema,
  createFaqSchema,
  createWebApplicationSchema,
} from "@/lib/seo/structured-data";
import { cn } from "@/lib/utils";

import { Faq } from "../_components/faq";
import { Footer } from "../_components/footer";
import { Header } from "../_components/header";
import {
  bodyClass,
  ButtonLink,
  cardClass,
  Eyebrow,
  h1Class,
  h3Class,
  leadClass,
  Section,
  SectionHeading,
  StepChip,
} from "../_components/site-primitives";
import { IconCardGrid } from "../whatsapp-link-generator/icon-card-grid";
import { featuresSignupHref } from "../whatsapp-link-generator/utils";
import { WhatsAppLinkGenerator } from "../whatsapp-link-generator/whatsapp-link-generator";

import type { IconCard } from "../whatsapp-link-generator/icon-card-grid";
import type { Metadata } from "next";

// Brazilian Portuguese version of /whatsapp-link-generator: same tool, translated copy. The root
// layout's <html lang="en"> can't vary per route while staying static, so the page's outermost
// element declares pt-BR (next.config.js adds Content-Language). The shared header and footer stay
// in English; their wrappers are display: contents so the header stays sticky for the whole page.
const CAMPAIGN = "whatsapp-link-pt";

const description =
  "Crie um link wa.me com mensagem pronta e um QR code em PNG ou SVG. Grátis, no seu navegador, sem cadastro. Depois encurte o link e veja os cliques no iShortn.";

export const metadata: Metadata = {
  title: "Gerar link do WhatsApp: mensagem, QR code e link curto",
  description,
  keywords: [
    "gerar link whatsapp",
    "gerador de link whatsapp",
    "link whatsapp com mensagem",
    "link whatsapp curto",
    "encurtar link whatsapp",
    "qr code whatsapp com mensagem",
    "link do whatsapp para instagram",
  ],
  alternates: {
    canonical: "/gerador-de-link-whatsapp",
    languages: {
      en: "/whatsapp-link-generator",
      "pt-BR": "/gerador-de-link-whatsapp",
      "x-default": "/whatsapp-link-generator",
    },
  },
  openGraph: {
    title: "Gerador de link do WhatsApp grátis | iShortn",
    description,
    type: "website",
    url: "/gerador-de-link-whatsapp",
    locale: "pt_BR",
  },
};

const steps: { title: string; body: string }[] = [
  {
    title: "Coloque seu número",
    body: "Escolha o país e digite seu número do WhatsApp com DDD. O link precisa do número internacional completo, então a gente adiciona o código do país (+55 no Brasil).",
  },
  {
    title: "Escreva a primeira mensagem",
    body: "Coloque o texto que você quer que o cliente use para começar, como um pedido ou um agendamento. Ele pode mudar antes de enviar.",
  },
  {
    title: "Compartilhe o link ou imprima o código",
    body: "Coloque o link na bio do Instagram, no Perfil da Empresa no Google ou nos seus e-mails. Baixe o QR code para cardápios, panfletos, embalagens e o balcão.",
  },
];

const ideas: IconCard[] = [
  {
    title: "Cardápios e mesas",
    body: "Um código no cardápio ou no display da mesa deixa o cliente pedir, reservar ou tirar uma dúvida sem precisar ligar.",
    icon: <IconToolsKitchen2Filled aria-hidden="true" />,
  },
  {
    title: "Bio do Instagram e do TikTok",
    body: "Coloque o link na bio para os seguidores chamarem você com um toque, com o nome do produto já na mensagem.",
    icon: <IconUserFilled aria-hidden="true" />,
  },
  {
    title: "Perfil da Empresa no Google e site",
    body: "Use como botão de conversa, para quem encontra você no Maps mandar mensagem em vez de ligar.",
    icon: <IconWorldFilled aria-hidden="true" />,
  },
  {
    title: "Embalagens e comprovantes",
    body: "Um código na sacola ou no comprovante traz o cliente de volta para um novo pedido ou uma dúvida.",
    icon: <IconBasketFilled aria-hidden="true" />,
  },
];

const shortLinkFeatures: IconCard[] = [
  {
    title: "Troque o número depois",
    body: "Aponte o link curto ou o QR code para um novo número ou uma nova mensagem sem reimprimir nada.",
    icon: <IconEditFilled aria-hidden="true" />,
  },
  {
    title: "Conte toques e leituras",
    body: `Veja cliques por dia, país, aparelho e origem. O plano grátis mostra os últimos ${PLAN_CAPS.free.analyticsRangeLimitDays} dias.`,
    icon: <IconChartAreaLineFilled aria-hidden="true" />,
  },
  {
    title: "Use seu próprio domínio",
    body: "No Pro, os links ficam como chat.sualoja.com.br/pedido em vez de um endereço wa.me comprido.",
    icon: <IconWorldFilled aria-hidden="true" />,
  },
  {
    title: "QR codes dinâmicos grátis",
    body: `O plano grátis inclui ${FREE_QR_CODE_LIMIT} QR codes dinâmicos, e eles não expiram.`,
    icon: <IconQrcode aria-hidden="true" />,
  },
];

const faqs = [
  {
    q: "Como gerar um link do WhatsApp?",
    a: "Digite seu número com DDD (e com o código do país, se não for do Brasil) e, se quiser, uma mensagem. O gerador cria um link como https://wa.me/5511912345678?text=Olá. Quem tocar nele abre uma conversa com você, no celular ou no WhatsApp Web.",
  },
  {
    q: "Qual é o formato do link wa.me?",
    a: "É https://wa.me/ seguido do seu número internacional completo, só com dígitos: sem o sinal de +, sem espaços ou traços e sem o 0 do começo. No Brasil fica 55 + DDD + número, como 5511912345678. Para incluir uma mensagem, adicione ?text= e o texto codificado para URL. O gerador faz isso por você.",
  },
  {
    q: "Como colocar uma mensagem no link do WhatsApp?",
    a: "Escreva no campo Mensagem. O gerador codifica espaços, quebras de linha e emojis para que cheguem do jeito que você escreveu. A pessoa vê a mensagem já digitada e pode editar antes de enviar.",
  },
  {
    q: "O link do WhatsApp expira?",
    a: "Não. Um link wa.me não tem prazo de validade e funciona enquanto o número estiver no WhatsApp. Os QR codes desta página também não expiram, porque o link fica gravado no próprio código. Se você encurtar o link no iShortn, os QR codes dinâmicos também não expiram, inclusive no plano grátis.",
  },
  {
    q: "Como fazer um link curto do WhatsApp?",
    a: "Com mensagem, o link wa.me fica comprido. Toque em Encurtar e acompanhar este link e crie sua conta grátis. O link já chega preenchido no iShortn, e você ganha um endereço curto como isht.app/sualoja, que pode trocar de destino depois e mostra quantas pessoas clicaram.",
  },
  {
    q: "Preciso do WhatsApp Business?",
    a: "Não. Os links de conversa funcionam com contas pessoais e com o WhatsApp Business. O app WhatsApp Business também tem um link curto e um QR code próprios, nas ferramentas comerciais, com uma mensagem pronta. Use este gerador se você tem uma conta pessoal, quer uma mensagem diferente para cada lugar onde divulga o link ou precisa de um arquivo SVG para impressão.",
  },
  {
    q: "Por que o link diz que o número não está no WhatsApp?",
    a: "Normalmente falta o código do país ou o DDD, ou ficou o 0 da discagem local. Confira o número que aparece embaixo do campo: ele deve começar com + e o código do país (+55 no Brasil), seguido do DDD e do número. Veja também se esse número tem WhatsApp.",
  },
  {
    q: "Dá para mudar o número de um QR code já impresso?",
    a: "Não com um código desta página, porque o número e a mensagem ficam gravados no desenho. Se você encurtar o link com o iShortn antes e imprimir esse código, pode mudar o destino quando quiser e o código impresso continua funcionando.",
  },
  {
    q: "Dá para ver quantas pessoas clicaram no meu link do WhatsApp?",
    a: "O WhatsApp não informa cliques em links. Encurte o link com o iShortn e veja os cliques por dia, país e aparelho, também no plano grátis.",
  },
  {
    q: "Link wa.me é seguro?",
    a: "Um link wa.me verdadeiro só abre uma conversa. Nada é enviado até você tocar em enviar, e dá para editar a mensagem antes. Golpes costumam usar endereços parecidos, como wa-me ou whatsap, então confira se o link vai mesmo para wa.me.",
  },
  {
    q: "Como colocar o link do WhatsApp na bio do Instagram?",
    a: "Copie o link wa.me desta página. No Instagram, vá em Editar perfil, toque em Links, depois em Adicionar link externo, e cole o link. Se quiser saber quantas pessoas tocaram, cole o link curto do iShortn no lugar.",
  },
  {
    q: "Por que o WhatsApp não lê meu QR code?",
    a: "O leitor dentro do WhatsApp só lê os códigos do próprio WhatsApp. Abra a câmera do celular ou um leitor de QR code, e o código abre a conversa.",
  },
  {
    q: "O que eu digito fica salvo?",
    a: "Não. O gerador funciona no seu navegador, e seu número e sua mensagem não vão para os nossos servidores, a não ser que você escolha encurtar o link.",
  },
];

export default function WhatsAppLinkGeneratorPtBrPage() {
  return (
    <div lang="pt-BR">
      <div lang="en" className="contents">
        <Header />
      </div>
      <main>
        <JsonLd
          data={createBreadcrumbSchema([
            { name: "Início", url: "https://ishortn.ink" },
            {
              name: "Gerador de link do WhatsApp",
              url: "https://ishortn.ink/gerador-de-link-whatsapp",
            },
          ])}
        />
        <JsonLd data={createFaqSchema(faqs.map((f) => ({ question: f.q, answer: f.a })))} />
        <JsonLd
          data={createWebApplicationSchema({
            name: "Gerador de link do WhatsApp",
            url: "https://ishortn.ink/gerador-de-link-whatsapp",
            description,
            inLanguage: "pt-BR",
          })}
        />
        {/* Hero + generator */}
        <Section className="py-16 sm:py-24">
          <div className="flex flex-col items-center text-center">
            <Eyebrow icon={<IconMessageCircleFilled aria-hidden="true" />}>
              Gerador de link do WhatsApp
            </Eyebrow>
            <h1 className={cn(h1Class, "mt-5 max-w-[20ch]")}>Gerador de link do WhatsApp grátis</h1>
            <p className={cn(leadClass, "mt-5 max-w-[52ch]")}>
              Crie um link wa.me com a mensagem já escrita e um QR code para imprimir. Funciona no
              seu navegador e não precisa de cadastro.
            </p>
          </div>
          <div className="mt-12 sm:mt-14">
            <WhatsAppLinkGenerator locale="pt-BR" defaultRegion="BR" campaign={CAMPAIGN} />
            <p className="mx-auto mt-4 max-w-4xl text-pretty text-center text-sm text-neutral-600">
              WhatsApp é uma marca da WhatsApp LLC. O iShortn não tem vínculo com o WhatsApp nem com
              a Meta, e não é endossado por eles.
            </p>
            <p className="mx-auto mt-2 max-w-4xl text-center text-sm text-neutral-600">
              <Link
                href="/whatsapp-link-generator"
                hrefLang="en"
                lang="en"
                className="underline decoration-neutral-300 underline-offset-4 hover:text-neutral-900 hover:decoration-neutral-900"
              >
                In English
              </Link>
            </p>
          </div>
        </Section>

        {/* How to */}
        <Section>
          <SectionHeading
            eyebrow={<Eyebrow icon={<IconBulbFilled aria-hidden="true" />}>Como funciona</Eyebrow>}
            title="Como criar um link do WhatsApp"
            subtitle="Um link abre uma conversa com você, com a mensagem pronta para enviar."
          />
          <ol className="mx-auto mt-14 grid max-w-5xl gap-4 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title} className={cn(cardClass, "p-6 sm:p-8")}>
                <StepChip>{String(i + 1).padStart(2, "0")}</StepChip>
                <h3 className={cn(h3Class, "mt-6")}>{step.title}</h3>
                <p className={cn(bodyClass, "mt-2 sm:text-sm")}>{step.body}</p>
              </li>
            ))}
          </ol>
        </Section>

        {/* Where to use it */}
        <Section>
          <SectionHeading
            eyebrow={<Eyebrow icon={<IconSparklesFilled aria-hidden="true" />}>Ideias</Eyebrow>}
            title="Onde usar seu link do WhatsApp"
          />
          <IconCardGrid items={ideas} />
        </Section>

        {/* Shorten with iShortn */}
        <Section>
          <SectionHeading
            eyebrow={<Eyebrow icon={<IconLinkFilled aria-hidden="true" />}>Links curtos</Eyebrow>}
            title="Link curto do WhatsApp que você acompanha e pode mudar"
            subtitle="O WhatsApp não mostra quantas pessoas tocaram no seu link. O iShortn mostra."
            actions={
              <>
                <ButtonLink href={featuresSignupHref(CAMPAIGN)}>Comece grátis</ButtonLink>
                <ButtonLink variant="soft" href="/pricing">
                  Ver preços
                </ButtonLink>
              </>
            }
          />
          <IconCardGrid items={shortLinkFeatures} />
        </Section>

        <Faq
          faqs={faqs}
          eyebrow="Dúvidas"
          title="Perguntas frequentes"
          subtitle="As perguntas que mais recebemos sobre links do WhatsApp."
        />

        {/* Closing call to action (the shared CTA is in English) */}
        <Section>
          <SectionHeading
            title="Links curtos, QR codes e cliques no mesmo lugar"
            subtitle="Crie sua conta grátis em menos de um minuto. O painel é em inglês."
            actions={
              <>
                <ButtonLink
                  href={`/auth/sign-up?utm_source=ishortn&utm_medium=tool&utm_campaign=${CAMPAIGN}&utm_content=cta`}
                >
                  Criar conta grátis
                </ButtonLink>
                <ButtonLink variant="soft" href="/pricing">
                  Ver preços
                </ButtonLink>
              </>
            }
          />
        </Section>
      </main>
      <div lang="en" className="contents">
        <Footer />
      </div>
    </div>
  );
}

import { describe, expect, test } from "bun:test";

import { isSocialReferrer, referrerChannel } from "./referrer";
import { describeVisitor, inAppSource, inferSource, parseDeviceDetails } from "./visitor";

const UA = {
  facebookIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/443.0.0.32.108;FBBV/540658032;FBDV/iPhone14,2;FBMD/iPhone;FBSN/iOS;FBSV/17.1.2;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5;FBRV/543037452]",
  facebookAndroid:
    "Mozilla/5.0 (Linux; Android 13; SM-S918B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.163 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/443.0.0.23.229;]",
  messengerAndroid:
    "Mozilla/5.0 (Linux; Android 12; SM-A525F Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.163 Mobile Safari/537.36 [FB_IAB/Orca-Android;FBAV/435.0.0.25.115;]",
  instagramIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 307.0.2.24.103 (iPhone15,3; iOS 17_1; en_US; en; scale=3.00; 1290x2796; 532277823)",
  instagramAndroid:
    "Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230901.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/118.0.5993.111 Mobile Safari/537.36 Instagram 307.0.0.34.111 Android (33/13; 420dpi; 1080x2205; Google/google; Pixel 7; panther; panther; en_US; 532277821)",
  tiktokIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_31.5.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/en Region/US ByteFullLocale/en isDarkMode/0 WKWebView/1 RevealType/Dialog BytedanceWebview/d8a21c6",
  tiktokAndroid:
    "Mozilla/5.0 (Linux; Android 12; SM-G991B Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.66 Mobile Safari/537.36 trill_2023105030 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/trill app_version/31.5.3 ByteLocale/en ByteFullLocale/en Region/GB AppId/1180 Spark/1.4.6.3-bugfix AppVersion/31.5.3 BytedanceWebview/d8a21c6",
  linkedinIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.29.6812",
  linkedinAndroid:
    "Mozilla/5.0 (Linux; Android 13; SM-A536B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.163 Mobile Safari/537.36 [LinkedInApp]/4.1.881",
  snapchatIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Snapchat/12.60.0.43 (like Safari/8617.1.17.10.9, panda)",
  snapchatAndroid:
    "Mozilla/5.0 (Linux; Android 13; SM-G998B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.163 Mobile Safari/537.36 Snapchat/12.61.0.38 (SM-G998B; Android 13#G998BXXU9EWJ6#33; gzip; )",
  twitterAndroid:
    "Mozilla/5.0 (Linux; Android 13; Pixel 6 Build/TQ3A.230805.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 TwitterAndroid",
  pinterestIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [Pinterest/iOS]",
  threadsAndroid:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UD1A.231105.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.163 Mobile Safari/537.36 Barcelona 307.0.0.45.89 Android (34/14; 420dpi; 1080x2205; Google/google; Pixel 8; shiba; shiba; en_US; 533201839)",
  wechat:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.44(0x18002c2f) NetType/WIFI Language/zh_CN",
  lineAndroid:
    "Mozilla/5.0 (Linux; Android 13; SM-S901N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.163 Mobile Safari/537.36 Line/13.20.1/IAB",
  telegramAndroid:
    "Mozilla/5.0 (Linux; Android 13; SM-A546B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.163 Mobile Safari/537.36 Telegram-Android/10.2.9 (Samsung SM-A546B; Android 13; SDK 33; HIGH)",
  googleApp:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/290.0.584276453 Mobile/15E148 Safari/604.1",
  chromeDesktop:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

async function sourceFor(userAgent: string) {
  const { browser } = await parseDeviceDetails(new Headers({ "user-agent": userAgent }));
  return inAppSource(browser, userAgent);
}

describe("inAppSource", () => {
  test("recognises each app's in-app browser", async () => {
    const expected: [string, string][] = [
      [UA.facebookIos, "facebook"],
      [UA.facebookAndroid, "facebook"],
      [UA.messengerAndroid, "facebook"],
      [UA.instagramIos, "instagram"],
      [UA.instagramAndroid, "instagram"],
      [UA.tiktokIos, "tiktok"],
      [UA.tiktokAndroid, "tiktok"],
      [UA.linkedinIos, "linkedin"],
      [UA.linkedinAndroid, "linkedin"],
      [UA.snapchatIos, "snapchat"],
      [UA.snapchatAndroid, "snapchat"],
      [UA.twitterAndroid, "x"],
      [UA.pinterestIos, "pinterest"],
      [UA.threadsAndroid, "threads"],
      [UA.wechat, "wechat"],
      [UA.lineAndroid, "line"],
      [UA.telegramAndroid, "telegram"],
    ];
    for (const [userAgent, source] of expected) expect(await sourceFor(userAgent)).toBe(source);
  });

  test("ignores regular browsers and the Google app", async () => {
    expect(await sourceFor(UA.chromeDesktop)).toBeNull();
    expect(await sourceFor(UA.googleApp)).toBeNull();
  });
});

describe("inferSource", () => {
  const instagram = { browser: "Instagram", userAgent: UA.instagramIos };
  const chrome = { browser: "Chrome", userAgent: UA.chromeDesktop };

  test("a referrer wins over the in-app browser and QR", () => {
    expect(
      inferSource({ referrer: "https://l.instagram.com/?u=x", ...instagram, isQrCode: true }),
    ).toBe("instagram.com");
    expect(inferSource({ referrer: "https://news.ycombinator.com/", ...chrome })).toBe(
      "ycombinator.com",
    );
  });

  test("an in-app browser wins over QR", () => {
    expect(inferSource({ referrer: null, ...instagram, isQrCode: true })).toBe("instagram");
  });

  test("a QR tracking link without a referrer is a scan", () => {
    expect(inferSource({ referrer: null, ...chrome, isQrCode: true })).toBe("qr");
  });

  test("anything else is direct", () => {
    expect(inferSource({ referrer: null, ...chrome })).toBe("direct");
    expect(inferSource({ referrer: "", ...chrome, isQrCode: false })).toBe("direct");
  });
});

describe("describeVisitor", () => {
  const visit = (userAgent: string, isQrCode = false) =>
    describeVisitor({
      headers: new Headers({ "user-agent": userAgent }),
      ip: "203.0.113.7",
      country: "US",
      city: "Austin",
      isQrCode,
    });

  test("stores an Instagram in-app click without a referrer as social", async () => {
    const visitor = await visit(UA.instagramIos);
    expect(visitor?.referer).toBe("instagram");
    expect(isSocialReferrer(visitor!.referer)).toBe(true);
  });

  test("stores a no-referrer QR click as a scan", async () => {
    const visitor = await visit(UA.chromeDesktop, true);
    expect(visitor?.referer).toBe("qr");
    expect(referrerChannel(visitor!.referer)).toBe("qr");
  });

  test("keeps desktop Chrome without a referrer as direct", async () => {
    expect((await visit(UA.chromeDesktop))?.referer).toBe("direct");
  });
});

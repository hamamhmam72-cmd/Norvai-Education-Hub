import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { translations, type TranslationKey } from "@/i18n/translations";
import { translateLegacyUiText } from "@/i18n/legacyUiArabic";

type Lang = "en" | "ar";

interface LanguageContextType {
  lang: Lang;
  toggleLang: () => void;
  t: (key: TranslationKey) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();
const translatedAttributes = ["placeholder", "title", "aria-label", "alt"] as const;
const excludedTextParents = new Set(["SCRIPT", "STYLE", "PRE", "CODE", "TEXTAREA"]);

function localizeTextNode(node: Text, lang: Lang, refreshSource = false) {
  const parent = node.parentElement;
  if (!parent || excludedTextParents.has(parent.tagName) || parent.closest("[data-no-auto-translate]")) return;
  if (refreshSource || !originalText.has(node)) originalText.set(node, node.nodeValue ?? "");
  const source = originalText.get(node) ?? "";
  const next = lang === "ar" ? translateLegacyUiText(source) : source;
  if (node.nodeValue !== next) node.nodeValue = next;
}

function localizeElement(element: Element, lang: Lang) {
  let originals = originalAttributes.get(element);
  if (!originals) {
    originals = new Map();
    originalAttributes.set(element, originals);
  }
  for (const attribute of translatedAttributes) {
    const current = element.getAttribute(attribute);
    if (current !== null && !originals.has(attribute)) originals.set(attribute, current);
    const source = originals.get(attribute);
    if (source === undefined) continue;
    const next = lang === "ar" ? translateLegacyUiText(source) : source;
    if (current !== next) element.setAttribute(attribute, next);
  }
}

function localizeTree(root: Node, lang: Lang) {
  if (root.nodeType === Node.TEXT_NODE) {
    localizeTextNode(root as Text, lang);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) localizeElement(root as Element, lang);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) localizeTextNode(node as Text, lang);
    else localizeElement(node as Element, lang);
    node = walker.nextNode();
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    const requested = new URLSearchParams(window.location.search).get("lang");
    if (requested === "ar" || requested === "en") return requested;
    return (localStorage.getItem("norv_lang") as Lang) || "en";
  });

  const isRTL = lang === "ar";

  useEffect(() => {
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    localStorage.setItem("norv_lang", lang);
    localizeTree(document.body, lang);

    const observer = new MutationObserver((mutations) => {
      observer.disconnect();
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          localizeTextNode(mutation.target as Text, lang, true);
        } else {
          mutation.addedNodes.forEach((node) => localizeTree(node, lang));
          if (mutation.target instanceof Element) localizeElement(mutation.target, lang);
        }
      }
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: [...translatedAttributes],
      });
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...translatedAttributes],
    });
    return () => observer.disconnect();
  }, [lang, isRTL]);

  const toggleLang = () => setLang(prev => prev === "en" ? "ar" : "en");

  const t = (key: TranslationKey): string => {
    return translations[lang][key] ?? translations["en"][key] ?? key;
  };

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}

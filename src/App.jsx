import { useEffect, useState } from "react";
import { Download, Copy, Check, ArrowUpRight, AlertCircle } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────
// PORTAL DE MARCA · monJARDIM
// Conectado ao Supabase em tempo real. Para usar com outra marca, basta
// trocar o BRAND_SLUG abaixo. Tudo o mais vem do banco.
// ─────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = "https://rinkrxztwdzvksxamsdk.supabase.co";
const SUPABASE_KEY = "sb_publishable_MPk8VBWjB8bWTtSAJoJfOg_avpQC69c";
const STORAGE_PUBLIC = `${SUPABASE_URL}/storage/v1/object/public/brand-assets/`;
const BRAND_SLUG = "pixxel";

// ═══════════════════════════════════════════════════════════════════════
// DATA LAYER · busca e transforma os dados do banco
// ═══════════════════════════════════════════════════════════════════════

async function loadBrandData(slug) {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
  };
  const base = `${SUPABASE_URL}/rest/v1`;

  const brandRes = await fetch(`${base}/brands?slug=eq.${slug}&select=*`, { headers });
  if (!brandRes.ok) throw new Error(`Falha ao buscar marca (${brandRes.status})`);
  const [brand] = await brandRes.json();
  if (!brand) throw new Error(`Marca "${slug}" não encontrada no banco`);

  const [tokens, pages, assets] = await Promise.all([
    fetch(`${base}/brand_tokens?brand_id=eq.${brand.id}&order=sort_order&select=*`, { headers }).then(r => r.json()),
    fetch(`${base}/brand_pages?brand_id=eq.${brand.id}&order=sort_order&select=*`, { headers }).then(r => r.json()),
    fetch(`${base}/brand_assets?brand_id=eq.${brand.id}&order=sort_order&select=*`, { headers }).then(r => r.json()),
  ]);

  return transformToPortalData(brand, tokens, pages, assets);
}

function transformToPortalData(brand, tokens, pages, assets) {
  // Logo principal (URL sem ?download= para renderizar inline)
  let primaryLogoUrl = null;
  if (brand.primary_logo_asset_id) {
    const logoAsset = assets.find(a => a.id === brand.primary_logo_asset_id);
    if (logoAsset?.storage_path) {
      primaryLogoUrl = `${STORAGE_PUBLIC}${logoAsset.storage_path}`;
    }
  }

  // Cores
  const colors = tokens
    .filter(t => t.token_type === "color")
    .map(t => ({ key: t.token_key, label: t.label, ...t.token_value }));

  // Tipografia (defaults visuais por chave)
  const typeSizes = { display: "5rem", heading: "2.25rem", body: "1rem", caption: "0.75rem" };
  const typeLineHeights = { display: 1, heading: 1.1, body: 1.6, caption: 1.4 };
  const typography = tokens
    .filter(t => t.token_type === "typography")
    .map(t => ({
      label: t.label,
      weight: t.token_value.weight,
      sample: t.token_value.sample,
      letterSpacing: t.token_value.letter_spacing ?? "0",
      family: t.token_value.family,
      size: typeSizes[t.token_key] || "1rem",
      lineHeight: typeLineHeights[t.token_key] || 1.4,
      transform: t.token_key === "caption" ? "uppercase" : "none",
    }));

  // Páginas indexadas por slug
  const pagesBySlug = Object.fromEntries(pages.map(p => [p.slug, p]));

  // Agrupar assets por (category, name) com seus formatos
  // Pula 'system' (recursos internos do portal, como o logo do header)
  const groupsMap = new Map();
  for (const a of assets) {
    if (a.category === "system") continue;
    const key = `${a.category}::${a.name}`;
    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        name: a.name,
        category: a.category,
        preferredBackground: a.preferred_background,
        isPrimary: false,
        isPackage: a.name.startsWith("Pacote completo"),
        files: [],
        sortOrder: a.sort_order,
      });
    }
    const g = groupsMap.get(key);
    if (a.is_primary) g.isPrimary = true;
    g.files.push({
      format: a.file_format.toUpperCase(),
      colorSpace: a.color_space,
      url: a.external_url,
    });
  }
  const assetGroups = Array.from(groupsMap.values()).sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    name: brand.name,
    slug: brand.slug,
    tagline: brand.tagline,
    description: brand.description,
    primaryLogoUrl,
    version: "v1.0 · abr/2026",
    essence: "Built to run.",
    colors,
    typography,
    pages: pagesBySlug,
    assetGroups,
    // Atributos não estão estruturados no banco ainda; entram como JSON em iteração futura
    attributes: [
      { label: "Preciso",  description: "Sistemas que executam o que prometem." },
      { label: "Discreto", description: "Protagonismo da operação, não da marca." },
      { label: "Direto",   description: "Comunicação sem ruído." },
      { label: "Vivo",     description: "Verde como sinal de execução em andamento." },
    ],
    systemNote: "O verde #00E37A é a cor mais expressiva do sistema. Use com parcimônia — como acento, sinalizador ou ponto focal. Quando aplicado em grandes áreas, o fundo preferido é o preto, que potencializa o brilho.",
  };
}

const CATEGORY_LABELS = {
  all:        "Todos",
  logo:       "Logos",
  selo:       "Selos",
  grafismo:   "Grafismos",
  tipografia: "Tipografia",
};

// ═══════════════════════════════════════════════════════════════════════
// UI · sub-componentes
// ═══════════════════════════════════════════════════════════════════════

function SectionNumber({ n, children }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.75rem",
      fontFamily: "'Sora', sans-serif", fontSize: "0.7rem", fontWeight: 500,
      letterSpacing: "0.18em", textTransform: "uppercase", color: "#59595B",
      marginBottom: "2rem",
    }}>
      <span>{n}</span>
      <span style={{ width: 24, height: 1, background: "#CCC" }} />
      <span>{children}</span>
    </div>
  );
}

function ColorSwatch({ color }) {
  const [copied, setCopied] = useState(false);
  const isLight = ["#FFFFFF","#80F1BD","#D9FBEA"].includes(color.hex);
  return (
    <button onClick={async () => {
      try { await navigator.clipboard.writeText(color.hex); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
    }} style={{
      textAlign: "left", background: "transparent", border: "none", padding: 0, cursor: "pointer",
      fontFamily: "'Sora', sans-serif", display: "flex", flexDirection: "column", width: "100%",
    }}>
      <div style={{
        background: color.hex, aspectRatio: "1.4 / 1", width: "100%",
        border: color.hex === "#FFFFFF" ? "1px solid #E5E5E5" : "none",
        display: "flex", alignItems: "flex-end", padding: "1rem",
      }}>
        <span style={{
          fontSize: "0.7rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase",
          color: isLight ? "#000" : "#FFF", opacity: 0.75,
          display: "inline-flex", alignItems: "center", gap: "0.4rem",
        }}>
          {copied ? <><Check size={11}/> copiado</> : <><Copy size={11}/> {color.hex}</>}
        </span>
      </div>
      <div style={{ paddingTop: "1rem" }}>
        <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.4rem" }}>{color.label}</div>
        {color.rgb && (
          <div style={{ fontSize: "0.75rem", color: "#59595B", lineHeight: 1.6 }}>
            <div>RGB {color.rgb}</div>
            {color.cmyk && <div>CMYK {color.cmyk}</div>}
            {color.pantone && <div>Pantone {color.pantone}</div>}
            {color.note && <div style={{ fontStyle: "italic", marginTop: "0.3rem" }}>{color.note}</div>}
          </div>
        )}
        {color.derivation && <div style={{ fontSize: "0.75rem", color: "#59595B" }}>{color.derivation}</div>}
      </div>
    </button>
  );
}

function TypeSample({ token }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "180px 1fr", gap: "2rem", alignItems: "baseline",
      paddingBottom: "2.5rem", marginBottom: "2.5rem", borderBottom: "1px solid #EFEFEF",
    }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: "0.3rem" }}>{token.label}</div>
        <div style={{ fontSize: "0.72rem", color: "#59595B", letterSpacing: "0.04em" }}>{token.family} · {token.weight}</div>
      </div>
      <div style={{
        fontWeight: token.weight, fontSize: token.size, letterSpacing: token.letterSpacing,
        lineHeight: token.lineHeight, textTransform: token.transform || "none",
      }}>
        {token.sample}
      </div>
    </div>
  );
}

function AssetCard({ group }) {
  const bgMap = { white: "#FFF", gray: "#59595B", black: "#000" };
  const previewBg = group.isPackage ? "#0A0A0A" : (bgMap[group.preferredBackground] || "#F7F7F7");

  return (
    <div style={{
      border: "1px solid " + (group.isPackage ? "#0A0A0A" : "#EFEFEF"),
      background: "#FFF", display: "flex", flexDirection: "column",
      transition: "border-color 0.2s ease",
      fontFamily: "'Sora', sans-serif",
    }}
    onMouseEnter={(e) => e.currentTarget.style.borderColor = "#000"}
    onMouseLeave={(e) => e.currentTarget.style.borderColor = group.isPackage ? "#0A0A0A" : "#EFEFEF"}>

      <div style={{
        height: 120, background: previewBg, display: "flex", alignItems: "center", justifyContent: "center",
        borderBottom: "1px solid #EFEFEF",
      }}>
        <span style={{
          fontSize: "0.65rem", fontWeight: 500, letterSpacing: "0.15em", textTransform: "uppercase",
          color: previewBg === "#FFF" ? "#CCC" : "rgba(255,255,255,0.55)",
        }}>
          {group.isPackage ? "Para designers · editável" : (CATEGORY_LABELS[group.category] || group.category)}
        </span>
      </div>

      <div style={{ padding: "1.25rem", flex: 1, display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <div style={{ fontSize: "0.95rem", fontWeight: 600, letterSpacing: "-0.01em", marginBottom: "0.25rem" }}>
            {group.name}
            {group.isPrimary && (
              <span style={{
                marginLeft: "0.5rem", fontSize: "0.6rem", fontWeight: 600,
                letterSpacing: "0.12em", textTransform: "uppercase", color: "#00E37A",
              }}>· primária</span>
            )}
          </div>
          <div style={{ fontSize: "0.7rem", color: "#59595B" }}>
            {group.files.length} formato{group.files.length > 1 ? "s" : ""} disponíve{group.files.length > 1 ? "is" : "l"}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "auto" }}>
          {group.files.map((f, i) => (
            <a key={i} href={f.url}
               style={{
                 padding: "0.4rem 0.7rem", border: "1px solid #EFEFEF", background: "#FFF",
                 fontFamily: "'Sora', sans-serif", fontSize: "0.7rem", fontWeight: 500,
                 letterSpacing: "0.02em", color: "#000", cursor: "pointer", textDecoration: "none",
                 display: "inline-flex", alignItems: "center", gap: "0.35rem",
                 transition: "all 0.15s ease",
               }}
               onMouseEnter={(e) => { e.currentTarget.style.background = "#000"; e.currentTarget.style.color = "#FFF"; }}
               onMouseLeave={(e) => { e.currentTarget.style.background = "#FFF"; e.currentTarget.style.color = "#000"; }}>
              <Download size={11} /> {f.format}{f.colorSpace ? `·${f.colorSpace}` : ""}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{
      fontFamily: "'Sora', sans-serif", minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "1rem",
    }}>
      <div style={{
        width: 40, height: 40, border: "2px solid #EFEFEF", borderTopColor: "#000",
        borderRadius: "50%", animation: "portal-spin 0.8s linear infinite",
      }} />
      <div style={{ fontSize: "0.75rem", color: "#59595B", letterSpacing: "0.15em", textTransform: "uppercase" }}>
        Carregando marca...
      </div>
    </div>
  );
}

function ErrorScreen({ message }) {
  return (
    <div style={{
      fontFamily: "'Sora', sans-serif", minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem",
    }}>
      <div style={{ maxWidth: 480, textAlign: "center" }}>
        <AlertCircle size={40} style={{ color: "#000", marginBottom: "1rem" }} />
        <h2 style={{ fontWeight: 600, marginBottom: "0.5rem", letterSpacing: "-0.02em" }}>
          Não foi possível carregar a marca
        </h2>
        <p style={{ fontSize: "0.9rem", color: "#59595B", lineHeight: 1.5 }}>{message}</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL · BrandPortal (recebe dados como prop)
// ═══════════════════════════════════════════════════════════════════════

function BrandPortal({ data }) {
  const [activePage, setActivePage] = useState("visao");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!document.getElementById("brand-portal-fonts")) {
      const link = document.createElement("link");
      link.id = "brand-portal-fonts";
      link.href = "https://fonts.googleapis.com/css2?family=Sora:wght@100..800&display=swap";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (!document.getElementById("portal-anim")) {
      const style = document.createElement("style");
      style.id = "portal-anim";
      style.textContent = "@keyframes portal-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }";
      document.head.appendChild(style);
    }
  }, []);

  const pages = [
    { id: "visao",     label: "Visão" },
    { id: "sistema",   label: "Sistema" },
    { id: "downloads", label: "Downloads" },
  ];

  const categories = ["all", ...Array.from(new Set(data.assetGroups.map(g => g.category)))];
  const visibleGroups = filter === "all" ? data.assetGroups : data.assetGroups.filter(g => g.category === filter);

  return (
    <div style={{
      fontFamily: "'Sora', sans-serif", background: "#FFFFFF", color: "#000",
      minHeight: "100vh", WebkitFontSmoothing: "antialiased",
    }}>
      <header style={{
        position: "sticky", top: 0, background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        borderBottom: "1px solid #EFEFEF", zIndex: 50,
      }}>
        <div style={{
          maxWidth: 1280, margin: "0 auto", padding: "1.1rem 2.5rem",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          {data.primaryLogoUrl && (
            <img src={data.primaryLogoUrl} alt={data.name} style={{ height: 32, width: "auto", display: "block" }} />
          )}
          <nav style={{ display: "flex", gap: "2.25rem", alignItems: "center" }}>
            {pages.map(p => (
              <button key={p.id} onClick={() => {
                setActivePage(p.id);
                document.getElementById(p.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }} style={{
                background: "none", border: "none", padding: 0, cursor: "pointer",
                fontFamily: "'Sora', sans-serif", fontSize: "0.85rem", fontWeight: 500,
                color: activePage === p.id ? "#000" : "#59595B",
                letterSpacing: "-0.01em", transition: "color 0.15s ease",
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = "#000"}
              onMouseLeave={(e) => e.currentTarget.style.color = activePage === p.id ? "#000" : "#59595B"}>
                {p.label}
              </button>
            ))}
            <span style={{
              fontSize: "0.65rem", fontWeight: 500, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "#59595B",
              paddingLeft: "1.5rem", borderLeft: "1px solid #EFEFEF",
            }}>{data.version}</span>
          </nav>
        </div>
      </header>

      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "7rem 2.5rem 5rem" }}>
        <div style={{ marginBottom: "3rem" }}>
          <SectionNumber n="00">Portal de marca</SectionNumber>
        </div>
        {data.primaryLogoUrl && (
          <img src={data.primaryLogoUrl} alt={data.name} style={{
            height: "clamp(50px, 6vw, 85px)", width: "auto", display: "block", marginBottom: "2.5rem",
          }} />
        )}
        <p style={{
          fontSize: "clamp(1.1rem, 1.8vw, 1.5rem)", fontWeight: 400, color: "#000",
          maxWidth: 720, lineHeight: 1.4, letterSpacing: "-0.01em", margin: "0 0 2.5rem 0",
        }}>{data.tagline}</p>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "0.75rem",
          fontSize: "0.85rem", fontWeight: 500, color: "#59595B", letterSpacing: "0.04em",
        }}>
          <span style={{ width: 32, height: 1, background: "#00E37A" }} />
          <span style={{ color: "#000", fontWeight: 600 }}>{data.essence}</span>
        </div>
      </section>

      <section id="visao" style={{
        maxWidth: 1280, margin: "0 auto", padding: "5rem 2.5rem", borderTop: "1px solid #EFEFEF",
      }}>
        <SectionNumber n="01">Visão</SectionNumber>
        <div style={{
          display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.5fr)",
          gap: "4rem", marginBottom: "4rem",
        }}>
          <h2 style={{
            fontSize: "clamp(2rem, 3.5vw, 3rem)", fontWeight: 600, letterSpacing: "-0.03em",
            lineHeight: 1.05, margin: 0,
          }}>O território conceitual da {data.name}.</h2>
          <div style={{ fontSize: "1.05rem", lineHeight: 1.7, color: "#000" }}>
            <p style={{ margin: 0, color: "#59595B" }}>{data.description}</p>
          </div>
        </div>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1px", background: "#EFEFEF",
          borderTop: "1px solid #EFEFEF", borderBottom: "1px solid #EFEFEF",
        }}>
          {data.attributes.map((attr, i) => (
            <div key={attr.label} style={{ padding: "2.25rem 1.75rem", background: "#FFF" }}>
              <div style={{
                fontSize: "0.65rem", fontWeight: 500, letterSpacing: "0.15em",
                textTransform: "uppercase", color: "#59595B", marginBottom: "0.8rem",
              }}>0{i + 1}</div>
              <div style={{ fontSize: "1.35rem", fontWeight: 600, marginBottom: "0.5rem", letterSpacing: "-0.02em" }}>
                {attr.label}
              </div>
              <div style={{ fontSize: "0.85rem", color: "#59595B", lineHeight: 1.5 }}>
                {attr.description}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="sistema" style={{
        maxWidth: 1280, margin: "0 auto", padding: "5rem 2.5rem", borderTop: "1px solid #EFEFEF",
      }}>
        <SectionNumber n="02">Sistema Visual</SectionNumber>
        <h2 style={{
          fontSize: "clamp(2rem, 3.5vw, 3rem)", fontWeight: 600, letterSpacing: "-0.03em",
          lineHeight: 1.05, margin: "0 0 4rem 0", maxWidth: 700,
        }}>Cores, tipografia e fundamentos.</h2>

        <div style={{ marginBottom: "5rem" }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "flex-end",
            marginBottom: "2rem", paddingBottom: "1rem", borderBottom: "1px solid #EFEFEF",
          }}>
            <h3 style={{ fontSize: "1.4rem", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>Cores</h3>
            <span style={{
              fontSize: "0.7rem", color: "#59595B", letterSpacing: "0.06em",
              textTransform: "uppercase", fontWeight: 500,
            }}>clique para copiar</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "2rem" }}>
            {data.colors.map(c => <ColorSwatch key={c.key} color={c} />)}
          </div>
          <div style={{
            marginTop: "2.5rem", padding: "1.25rem 1.5rem", background: "#000", color: "#FFF",
            fontSize: "0.9rem", lineHeight: 1.55, display: "flex", gap: "1.25rem",
          }}>
            <div style={{ width: 3, alignSelf: "stretch", background: "#00E37A", flexShrink: 0 }} />
            <div><strong>Uso da cor primária. </strong>{data.systemNote}</div>
          </div>
        </div>

        <div>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "flex-end",
            marginBottom: "2rem", paddingBottom: "1rem", borderBottom: "1px solid #EFEFEF",
          }}>
            <h3 style={{ fontSize: "1.4rem", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>Tipografia</h3>
            <span style={{
              fontSize: "0.7rem", color: "#59595B", letterSpacing: "0.06em",
              textTransform: "uppercase", fontWeight: 500,
            }}>{data.typography[0]?.family} · Google Fonts</span>
          </div>
          {data.typography.map((t, i) => <TypeSample key={i} token={t} />)}
        </div>
      </section>

      <section id="downloads" style={{
        maxWidth: 1280, margin: "0 auto", padding: "5rem 2.5rem", borderTop: "1px solid #EFEFEF",
      }}>
        <SectionNumber n="03">Downloads</SectionNumber>
        <h2 style={{
          fontSize: "clamp(2rem, 3.5vw, 3rem)", fontWeight: 600, letterSpacing: "-0.03em",
          lineHeight: 1.05, margin: "0 0 1rem 0",
        }}>Arquivos prontos para uso.</h2>
        <p style={{ fontSize: "0.95rem", color: "#59595B", maxWidth: 640, lineHeight: 1.6, margin: "0 0 3rem 0" }}>
          Cada item agrupa todos os formatos disponíveis. Use <strong style={{ color: "#000" }}>RGB</strong> para digital
          e <strong style={{ color: "#000" }}>CMYK</strong> para impressão. <strong style={{ color: "#000" }}>AI</strong> são vetores editáveis.
        </p>
        <div style={{ display: "flex", gap: "0.4rem", marginBottom: "2rem", flexWrap: "wrap" }}>
          {categories.map(cat => {
            const count = cat === "all" ? data.assetGroups.length : data.assetGroups.filter(g => g.category === cat).length;
            const active = filter === cat;
            return (
              <button key={cat} onClick={() => setFilter(cat)} style={{
                padding: "0.5rem 1rem", background: active ? "#000" : "transparent",
                color: active ? "#FFF" : "#000", border: "1px solid", borderColor: active ? "#000" : "#EFEFEF",
                fontFamily: "'Sora', sans-serif", fontWeight: 500, fontSize: "0.8rem",
                letterSpacing: "-0.01em", cursor: "pointer", transition: "all 0.15s ease",
              }}>
                {CATEGORY_LABELS[cat] || cat}
                <span style={{ marginLeft: "0.45rem", opacity: 0.55, fontSize: "0.72rem" }}>{count}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
          {visibleGroups.map((g, i) => <AssetCard key={`${g.category}-${g.name}-${i}`} group={g} />)}
        </div>
      </section>

      <footer style={{ borderTop: "1px solid #EFEFEF", marginTop: "3rem" }}>
        <div style={{
          maxWidth: 1280, margin: "0 auto", padding: "2.5rem", display: "flex",
          justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1.5rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {data.primaryLogoUrl && (
              <img src={data.primaryLogoUrl} alt={data.name} style={{ height: 24 }} />
            )}
            <span style={{ width: 1, height: 14, background: "#EFEFEF" }} />
            <span style={{ fontSize: "0.75rem", color: "#59595B", letterSpacing: "0.04em" }}>
              Portal de marca · {data.version}
            </span>
          </div>
          <a href="https://www.monjardim.com" target="_blank" rel="noopener noreferrer" style={{
            fontSize: "0.7rem", color: "#59595B", letterSpacing: "0.1em",
            textTransform: "uppercase", fontWeight: 500, textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: "0.5rem",
          }}>
            <span>Curadoria</span>
            <span style={{ color: "#000", fontWeight: 600 }}>monJARDIM Branding & Design</span>
            <ArrowUpRight size={12} />
          </a>
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// APP · busca dados ao montar e renderiza
// ═══════════════════════════════════════════════════════════════════════

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadBrandData(BRAND_SLUG)
      .then(setData)
      .catch(err => setError(err.message || "Erro desconhecido"));
  }, []);

  if (error) return <ErrorScreen message={error} />;
  if (!data) return <LoadingScreen />;
  return <BrandPortal data={data} />;
}

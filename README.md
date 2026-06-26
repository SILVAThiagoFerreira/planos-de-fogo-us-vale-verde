# Planos de Fogo · Previsto × Realizado · US Vale Verde

Dashboard estático (HTML/CSS/JS + Chart.js via CDN) que compara o
**planejamento** (Previsto) com a **execução** (Realizado) dos desmontes
da US Vale Verde. Lê as planilhas do Google Sheets **em tempo real** no
navegador (API gviz) — atualiza sozinho a cada acesso, sem servidor,
build ou cron.

**Online:** <https://silvathiagoferreira.github.io/planos-de-fogo-us-vale-verde/>

## Fontes de dados

| Base | Planilha (compartilhada “qualquer pessoa com o link”) | Período |
|------|-------------------------------------------------------|---------|
| Previsto  | Planos de Fogo Previsto  | jan/2024 – jun/2026 |
| Realizado | Planos de Fogo Realizado | jun/2020 – jun/2026 |

As duas bases são **ligadas pelo número do *Plano***: quando o mesmo plano
existe nas duas planilhas ele é “casado”, permitindo comparar o planejado
com o executado (gráfico de precisão e tabela). As séries temporais agregam
pela média (ou somatório, para volume/explosivos) mensal de cada aspecto.

## Aspectos comparados

Diâmetro · Afastamento · Espaçamento · Sub-furação · Tampão · Média de
Perfuração · Perfuração Específica · Nº de Furos · Carga Máxima por Espera ·
Densidade do Explosivo · Densidade da Rocha · Razão Linear de Carga · Razão
de Carga (RC) · Volume Desmontado · Total de Explosivos.

## Estrutura

- `index.html` / `styles.css` / `app.js` — aplicação (mesma linguagem visual
  do hub: `#38424B` + `#E20613`, cards brancos).
- `assets/` — logos.
- `.github/workflows/deploy-pages.yml` — publica no GitHub Pages a cada push
  na `main`.
- `.nojekyll` — serve os arquivos como-estão.

Parte do hub de dashboards da US Vale Verde.

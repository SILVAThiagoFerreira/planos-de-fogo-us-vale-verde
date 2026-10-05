# Planos de Fogo · Previsto × Realizado · US Vale Verde

Dashboard estático (HTML/CSS/JS + Chart.js via CDN) que compara o
**planejamento** (Previsto) com a **execução** (Realizado) dos desmontes
da US Vale Verde. O GitHub Actions baixa os arquivos Excel da pasta
compartilhada do Google Drive, converte os campos usados pelo painel e
publica uma nova versão a cada hora (ou ao publicar uma alteração na `main`).
Enquanto aberto, o painel busca a versão publicada a cada cinco minutos,
ao voltar para a aba e pelo botão **Atualizar**.

**Online:** <https://silvathiagoferreira.github.io/planos-de-fogo-us-vale-verde/>

## Fontes de dados

| Base | Arquivo do Drive | Período |
|------|------------------|---------|
| Previsto  | `Plano_Fogo_Previsto.xlsx`  | variável; exibido dinamicamente no painel |
| Realizado | `Plano_Fogo_Realizado.xlsx` | variável; exibido dinamicamente no painel |

As duas bases são **ligadas pelo identificador do *Plano***, preservando
códigos numéricos e alfanuméricos como `PP590926` e `PC590926_B`: quando o mesmo plano
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
- `scripts/build_data.py` — converte os `.xlsx` em dados compactos do painel,
  preservando identificadores numéricos e alfanuméricos.
- `data/` — cópia publicada apenas dos campos consumidos pelo dashboard; não
  inclui coordenadas, cliente nem os demais campos de origem.
- `.github/workflows/deploy-pages.yml` — sincroniza os arquivos do Drive a
  cada hora e publica no GitHub Pages.
- `.nojekyll` — serve os arquivos como-estão.

Parte do hub de dashboards da US Vale Verde.

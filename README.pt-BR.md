# HeadNav — Navegação sem as mãos

[English](README.md) · **Português**

Uma extensão para o Chrome que permite **navegar na internet só com a cabeça e os olhos**, sem
usar as mãos. Feita como ferramenta de **acessibilidade** para pessoas com mobilidade reduzida ou
ausente nas mãos (deficiência motora, tetraplegia).

> **Privacidade em primeiro lugar:** todo o processamento da câmera acontece **localmente, no seu
> navegador**. Nenhum quadro de vídeo sai do seu computador, e nenhuma telemetria é coletada.
>
> **O ditado por voz é opcional.** No modo **local**, o áudio fica no seu computador. No modo
> **online**, o Chrome envia o áudio ao Google para transformá-lo em texto, e o HeadNav pede sua
> autorização a cada uso, antes de abrir o microfone.

## Por quê

Quem não consegue usar mouse ou teclado deve conseguir ler, rolar e navegar pela internet com
conforto. O HeadNav transforma o movimento da cabeça em movimento do cursor, e gestos simples do
rosto em cliques, navegação e ditado por voz.

## Como usar

### Gestos

| Gesto | O que faz | O que o cursor mostra |
|---|---|---|
| Mover a cabeça | Move o cursor | Círculo azul |
| Parar o cursor 1,5 s sobre um link, botão ou campo | Clica. Um ímã puxa o cursor para alvos pequenos; para clicar de novo no mesmo alvo, afaste o cursor e volte | Anel laranja que se enche |
| Fechar o olho **esquerdo** por 2 s, com o outro aberto | Volta para a página anterior | Anel azul com ←; o cursor congela durante o gesto |
| Fechar o olho **direito** por 2 s, com o outro aberto | Avança para a página seguinte | Anel azul com → |
| Abrir a boca por 1,4 s | Pausa os cliques; repita o gesto para voltar a clicar. O cursor, os gestos de olho e a rolagem continuam funcionando | Anel roxo; enquanto pausado, cursor cinza com ⏸ |
| Deixar o cursor 2 s na faixa de cima ou de baixo da tela | Rola a página; quanto mais perto da borda, mais rápido | Anel verde com ↑ ou ↓ |

### Ditado por voz (opcional)

1. Pare o cursor sobre um campo de texto, como a busca do YouTube: o painel de ditado abre.
2. Pare sobre **Permitir e falar** (modo online) ou **Falar** (modo local).
3. Fale. O texto aparece enquanto você fala, e o microfone desliga sozinho quando você para
   (no máximo 15 s).
4. Confira o texto e pare sobre **Buscar** (campos de busca) ou **Inserir** (outros campos).
   **Falar de novo** refaz, e **Cancelar** descarta.

Enquanto o microfone escuta, os gestos ficam pausados e o cursor fica vermelho com 🎤, para que
falar não clique nem navegue por engano. Campos de senha nunca abrem o painel.

### Sinais

- **Cursor cinza com ?** — o rosto não está sendo visto: o cursor para e nada é clicado.
- **CAM** no ícone do HeadNav — a câmera está ligada. **MIC** em vermelho — o microfone está ligado.

### Configuração (uma vez, com ajuda)

Na página de configuração, um ajudante libera a câmera, libera o microfone (opcional), escolhe a
voz online ou local e instala a voz local, se precisar. Depois disso, o único passo é **Iniciar**
no ícone do HeadNav. O mesmo guia está dentro da extensão, em **Como usar**, no menu do HeadNav.

## Como funciona

A imagem da webcam é analisada pelo [MediaPipe Face Landmarker](https://developers.google.com/mediapipe/solutions/vision/face_landmarker)
inteiramente no computador. A pose da cabeça move o cursor (espelhado e suavizado com um filtro
One Euro), e os blendshapes do rosto (piscadas, boca) acionam os gestos por pequenas máquinas de
estados com histerese: uma piscada natural não dispara comando, e os gestos pausam enquanto você
dita.

Por causa das regras do Manifest V3, a câmera e o reconhecimento de voz rodam num **documento
offscreen**, o service worker encaminha os gestos e as sessões de ditado, e um content script
desenha o cursor e o painel de ditado na página. Uma **página de configuração**, usada uma vez,
libera a câmera e o microfone para a própria extensão, então nenhum site pede essas permissões.

## Tecnologias

- [WXT](https://wxt.dev/) + TypeScript
- [`@mediapipe/tasks-vision`](https://www.npmjs.com/package/@mediapipe/tasks-vision) (WASM e modelo empacotados localmente)
- Web Speech API, online ou no próprio computador
- Chrome Manifest V3 (documento offscreen, service worker, content script)
- Interface em inglês e português (i18n do Chrome)
- [Vitest](https://vitest.dev/) para a lógica dos gestos, do cursor e do ditado

## Status

Em desenvolvimento. Roteiro:

| # | Etapa | Estado |
|---|-------|--------|
| 0 | Fundação (scaffold, build, repositório) | ✅ |
| 1 | Câmera + pontos do rosto | ✅ |
| 2 | Cursor guiado pela cabeça (suavizado) | ✅ |
| 3 | Clique sem as mãos (parada com ímã nos alvos) | ✅ |
| 4 | Navegação por gestos (olho fechado para voltar/avançar, boca aberta para pausar, rolagem pelas bordas) | ✅ |
| 5 | Ditado por voz em campos de texto (opcional, online ou local) | ✅ |
| 6 | Calibração + configuração | ⬜ |
| 7 | Acabamento (GIF de demonstração, diagrama, testes) | ⬜ |

## Desenvolvimento

```bash
npm install      # instala as dependências
npm run dev      # abre um navegador de desenvolvimento com a extensão carregada
npm run build    # build de produção em .output/
npm run compile  # checagem de tipos
npm test         # testes unitários
npm run zip      # gera um zip para distribuição
```

Para carregar um build manualmente: abra `chrome://extensions`, ative o **Modo do desenvolvedor**,
clique em **Carregar sem compactação** e selecione `.output/chrome-mv3/`.

## Licença

MIT — veja [LICENSE](LICENSE).

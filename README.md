# KIRA — WebAR 0.6

Protótipo gratuito do TCC KIRA. Mantém a imagem-alvo provisória e a saída por punho. Não exige aplicativo nem conta para participar.

## Uso

1. Abra o endereço HTTPS pelo QR Code ou link e permita a câmera.
2. Mostre a imagem-alvo. Em seguida, enquadre a pessoa.
3. Corpo e ombros mantêm Ryuk na composição. Com os dois pés visíveis e confiáveis, eles fornecem a referência vertical. A escala pertence a um grupo diferente do movimento de flutuação.
4. O personagem inicia a sequência de caminhada após 10 s, caminha por 5 s, encara a pessoa por 2 s e flutua lateralmente.
5. Feche o punho inteiro por cerca de 1 s para ativar a fumaça de 128 partículas.
6. Se a pessoa sair, Ryuk é ocultado após uma tolerância curta contra falhas de detecção. Após 1,2 s sem rastreamento válido, a sessão encerra. Retire e apresente o alvo novamente para reativar; uma pessoa que entra depois não reabre a sessão sozinha.

O rastreamento usa MediaPipe Pose Landmarker Lite com 33 pontos, incluindo tornozelos, calcanhares e pontas dos pés. Não identifica o cosplayer por identidade. Usa continuidade espacial e não garante distinguir duas pessoas que se substituam na mesma posição sem intervalo. Não mede nem ancora o piso real em 3D. Pés fora da câmera ou com baixa confiança são ignorados; não são tratados como detecções válidas.

Os olhos vermelhos da pessoa foram removidos. O rosto e os olhos do modelo Ryuk usam as texturas originais, com materiais opacos corrigidos. Geometria, ossos, texturas e dois clipes originais foram preservados.

## Ensaios

Os botões em “Ensaios com imagens digitais” verificam corpo e pés em fotos, perda da pessoa, bloqueio de retorno sem alvo, escala durante flutuação, materiais do rosto, alvo e punho. São ensaios com arquivos; não substituem o teste no celular e no caderno físico. O JSON inclui a cadência real da renderização e os tempos dos dois processadores.

As imagens da câmera são processadas no aparelho, sem gravação nem envio. Dependências com versões fixas e WebAssembly podem carregar de CDN. Safari/iPhone, iPad e Android precisam ser testados individualmente. O recorte da pessoa mantém o Selfie Segmenter anterior. Processamento corporal e da mão ficam em workers separados; no máximo um quadro de cada tipo fica em processamento.

## Fontes e licenças

- [Pose Landmarker e modelo Lite](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker?tab=Web).
- [Modelo oficial](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task).
- [Foto de referência oficial MediaPipe](https://storage.googleapis.com/mediapipe-assets/pose.jpg), usada somente nos ensaios.
- MindAR MIT; Three.js MIT; MediaPipe Apache-2.0. Licenças incluídas. Créditos do Ryuk em `CREDITOS_RYUK.md`; a licença das bibliotecas não transfere direitos sobre personagens ou assets.

Projeto educacional. A capa física definitiva, a escala real e o novo rastreamento em movimento no celular permanecem dependentes de teste.

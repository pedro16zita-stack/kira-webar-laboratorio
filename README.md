# KIRA — animação natural 0.7

Experiência WebAR do TCC KIRA. Modelo, materiais e rastreamento existentes reaproveitados. O alvo continua provisório. A câmera não é gravada nem enviada a um servidor.

## Novidades

- Quatro clipes novos criados no Blender: presença suave, olhar para cada lado e caminhada calma. Os dois clipes originais continuam no GLB.
- Ciclos de presença de 8 s com movimentos pequenos de cabeça, torso, asas e acessórios; mistura gradual entre poses.
- Caminhada de 5 s: as pernas acompanham a distância percorrida e o corpo se vira na direção do movimento. A amplitude lateral diminui se faltar espaço no enquadramento.
- Espaço Próximo / Equilibrado / Afastado, proporcional ao corpo. Não é medição em metros.
- Movimento Suave permite até 60 quadros/s; Econômico limita a 30. O desempenho real fica no JSON e depende do aparelho.
- Botão Ver animação sem câmera: prévia de 20 s com foto, sem validar rastreamento físico.
- Comparação com a versão 0.6 preservada em versao-006.html.

## Fluxo preservado

1. Abra por QR Code ou link HTTPS e permita a câmera.
2. Mostre o caderno/alvo e depois enquadre a pessoa. O corpo mantém Ryuk na composição e os pés dão referência vertical quando detectados.
3. Observe presença, passos, olhar e flutuação. Ajuste o espaço lateral.
4. Feche o punho inteiro por cerca de 1 s para acionar a fumaça de 128 partículas.
5. Ao perder a pessoa, Ryuk é ocultado. Após encerrar a sessão, retire e apresente o alvo novamente.

Rastreamento corporal, oclusão, confirmação do punho e encerramento por perda usam os mesmos módulos da versão 0.6. Não há reconhecimento de identidade nem reconstrução do piso em 3D. A caminhada não garante contato exato com o chão real. Os olhos vermelhos da pessoa continuam retirados.

O GLB acrescenta animações ao modelo anterior, preservando integralmente o prefixo binário, a geometria e as texturas. Os originais permanecem nas versões anteriores. A cadência da câmera composta pode ser inferior à da animação 3D por depender da segmentação.

## Verificações

Os ensaios da página usam fotos e arquivos. Não substituem o teste no celular, com o cosplay e a capa definitiva. Pés, escala real, naturalidade do movimento e desempenho precisam ser conferidos no aparelho.

MindAR 1.2.5 MIT; Three.js 0.160.0 MIT; MediaPipe Tasks Vision 0.10.21 Apache-2.0. Créditos em CREDITOS_RYUK.md e licenças nos arquivos incluídos. Foto de teste: https://storage.googleapis.com/mediapipe-assets/pose.jpg . Documentação: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker?tab=Web .

# KIRA — laboratório WebAR

Protótipos de viabilidade para TCC de Design de Moda. Esta página é experimental; não é a experiência final.

1. Abra a página HTTPS no Safari (iPad/iPhone) ou Chrome (Android).
2. Abra alvo_provisorio.png em uma segunda tela ou impressão.
3. Escolha a câmera, inicie e autorize seu uso.
4. Mostre o alvo, retire-o e enquadre a pessoa. Se necessário, escolha o lado na tela. Feche o punho inteiro de frente para a câmera por cerca de 1 segundo; pontos verdes indicam mão detectada. Não é necessário abrir a palma antes.
5. Baixe os resultados; reporte aparelho, sistema, câmera e problemas.

A permanência é relativa à câmera, sem âncora espacial no ambiente. A versão 0.5 ajusta a escala pelo tamanho aparente do rosto e mantém a cabeça alinhada à pessoa: aproximar aumenta Ryuk e corta naturalmente a parte inferior do corpo; afastar mostra mais do personagem. O seletor de proporção continua disponível. Se perder o rosto, mantém a última proporção válida. Não é medição de distância em metros.

A sequência começa quando Ryuk aparece: aos 10 segundos, os olhos da pessoa começam a ficar vermelhos (transição de 1,2 s) e ele caminha lateralmente durante 5 s; depois encara a pessoa por 2 s e inicia flutuação lateral contínua. A caminhada é uma animação procedural de oito articulações do esqueleto existente. Sem rastreamento do chão, não garante contato dos pés com o piso. O punho interrompe a sequência e aciona a fumaça de saída de 2,6 s. As duas animações originais foram preservadas no GLB.

O recorte da pessoa e a detecção dos olhos usam o mesmo quadro capturado, evitando desenhar os olhos em um quadro diferente da silhueta. A cor é limitada à íris e recortada pelas pálpebras, preservando a pupila. Rostos distantes, parcialmente fora do enquadramento ou mal iluminados podem impedir o efeito. Se o recorte falhar, o laboratório informa o uso apenas da posição lateral; os olhos também ficam indisponíveis nesse modo.

Bordas, cabelo, olhos, velocidade e seguimento precisam ser validados no aparelho. A meta da renderização é 30 quadros/s; os resultados incluem a cadência efetivamente medida. A capa definitiva não foi testada. As imagens da câmera não são enviadas a um servidor. Dependências com versões fixadas podem carregar de CDN.

Código das bibliotecas: MindAR MIT; Three.js MIT; MediaPipe Apache-2.0. Consulte os arquivos *_MIT.txt e MEDIAPIPE_APACHE2.txt. Créditos e procedência do modelo em CREDITOS_RYUK.md; a licença das bibliotecas não concede direitos sobre personagens ou assets. Projeto educacional, sem afiliação oficial com Death Note ou seus titulares.

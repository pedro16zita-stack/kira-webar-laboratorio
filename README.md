# KIRA — laboratório WebAR

Protótipos de viabilidade para TCC de Design de Moda. Esta página é experimental; não é a experiência final.

1. Abra a página HTTPS no Safari (iPad/iPhone) ou Chrome (Android).
2. Abra alvo_provisorio.png em uma segunda tela ou impressão.
3. Escolha a câmera, inicie e autorize seu uso.
4. Mostre o alvo, retire-o e enquadre a pessoa. Se necessário, escolha o lado na tela. Feche o punho inteiro de frente para a câmera por cerca de 1 segundo; pontos verdes indicam mão detectada. Não é necessário abrir a palma antes.
5. Baixe os resultados; reporte aparelho, sistema, câmera e problemas.

A permanência é relativa à câmera, sem âncora espacial no ambiente. A versão 0.4 aplica segmentação da pessoa em um worker separado e coloca sua silhueta à frente do personagem; se indisponível, informa o uso apenas da posição lateral. Não é medição de profundidade 3D. Bordas, cabelo, mãos, velocidade e seguimento precisam ser validados no aparelho. A capa definitiva não foi testada. As imagens da câmera não são enviadas a um servidor. Dependências com versões fixadas podem carregar de CDN.

Código das bibliotecas: MindAR MIT; Three.js MIT; MediaPipe Apache-2.0. Consulte os arquivos *_MIT.txt e MEDIAPIPE_APACHE2.txt. Créditos e procedência do modelo em CREDITOS_RYUK.md; a licença das bibliotecas não concede direitos sobre personagens ou assets. Projeto educacional, sem afiliação oficial com Death Note ou seus titulares.

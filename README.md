# Le Beef — painel de vendas de ingressos

## Versão 6.0.12 — configuração térmica

- Removidos somente os seletores de cor sem efeito da aba **Impressão térmica**.
- As cores já armazenadas no cadastro do ingresso térmico são preservadas ao salvar; a impressão continua em preto e branco.
- Os controles de cor, a prévia e a geração do **PDF digital** permanecem inalterados.

## Versão 6.0.11 — ajustes do PDF digital

- Em **Espaçamentos do PDF**, o controle **Entre o topo e a logo** ajusta de 0 a 6 mm a distância da borda superior do cabeçalho até a logo. O padrão é 2 mm.
- Em **Logo e fontes**, o controle **Fonte do rodapé** altera as letras das informações de geração e identificação do ingresso entre 4 e 8 pt.
- Os dois ajustes são independentes do ingresso térmico, aparecem na pré-visualização e são salvos por evento para uso no PDF final.

## Versão 6.0.10 — resultados do promoter

- O perfil promoter acessa **Meus resultados** no menu Mais e pelo atalho do resumo. O relatório mostra somente vendas vinculadas à sua conta no evento selecionado, o total vendido e sua comissão por venda.
- **Ganhos confirmados** consideram apenas vendas pagas; **ganhos previstos** consideram vendas pendentes. Esses números não representam repasses já efetuados ao promoter.
- O promoter não recebe comandos de check-in de ingressos individuais ou reservas. As rotas da Portaria e as ações de validação por QR Code continuam bloqueadas para esse perfil.
- Para que o bloqueio seja efetivo no banco, as regras do Firebase publicadas devem incluir as restrições do perfil promoter para `sales`, `checkedIn`, `occupantCheckins` e `qrTickets` (como no arquivo `database.rules.json` entregue com a versão 6.0.3). Publicar apenas os arquivos do site não atualiza as regras do Realtime Database.

## Versão 6.0.3 — vendas por usuário e vendas online em preparação

- A área de vendas online permanece visível com o aviso “Em breve”, sem checkout ou conexão com o Mercado Pago nesta versão.
- Vendas individuais e reservas de mesas/bistrôs não permitem selecionar outro promoter.
- Quando o usuário autenticado é promoter, a venda nova recebe automaticamente seu identificador e sua comissão configurada.
- Ao editar uma venda existente, o vendedor/promoter original permanece inalterado.
- A configuração da taxa opcional das vendas manuais continua disponível dentro do cadastro/edição do evento.

- Cada evento possui página pública própria, endereço amigável e preparação para domínio personalizado.
- O administrador ou gerente conecta a conta Mercado Pago que receberá as vendas por OAuth; credenciais sensíveis ficam somente no backend.
- A loja pública usa o Checkout Transparente com Pix e cartões, confirma novamente o estoque no servidor e reserva os ingressos por 15 minutos.
- A taxa do comprador online é configurada por evento e aparece separada do subtotal antes do pagamento.
- Cada promoter recebe um link pessoal de venda online; pedidos feitos por esse link congelam o percentual e entram no relatório de comissão do promoter.
- A comissão da plataforma usa apenas o subtotal dos ingressos e respeita a regra do evento: online, manual, ambos ou nenhuma.
- Pedidos pendentes reservam estoque, mas não entram em faturamento, relatórios ou fechamentos até a aprovação.
- O webhook valida a assinatura do Mercado Pago, confirma a venda e gera os QR Codes uma única vez.
- Depois do pagamento, o comprador vê os ingressos e baixa o PDF usando o mesmo modelo digital configurado no evento.
- Um processo agendado remove reservas online expiradas e devolve os ingressos ao estoque.
- O backend está na pasta `functions` e as instruções de publicação estão em `FIREBASE-SETUP.md`.

## Versão 6.0.0 — base financeira por evento

- A versão 6.0 é desenvolvida em pasta completa e independente, preservando a versão 5.8.25.
- Cada evento passa a ter porcentagem própria de comissão da plataforma.
- A plataforma escolhe se a comissão vale para vendas online, manuais, ambas ou nenhuma.
- Cada nova venda e reserva manual salva uma fotografia da regra financeira aplicada no momento da operação.
- Alterações futuras na configuração do evento não recalculam retroativamente as vendas já registradas.

## Promoters por evento — versão 6.0.0

- Administradores e gerentes do evento possuem uma página dedicada para cadastrar promoters no evento selecionado.
- Cada promoter recebe conta individual, percentual próprio e definição dos canais que geram sua comissão.
- O promoter acessa somente as próprias vendas atribuídas, sem acesso à Portaria ou ao check-in.
- Novas vendas salvam uma fotografia do percentual e da regra do promoter; mudanças futuras não alteram vendas antigas.
- O relatório financeiro discrimina vendas pagas, base de cálculo e comissão de cada promoter.
- As novas regras do Firebase protegem a configuração financeira e impedem o promoter de adulterar atribuição, percentual ou check-in.

## Fechamentos por lote — versão 6.0.0

- O relatório financeiro mostra a comissão que ainda não entrou em nenhum fechamento.
- O administrador pode agrupar todas as vendas pagas disponíveis em um lote imutável.
- Cada fechamento preserva as vendas, a base e o valor devido no momento em que foi criado.
- É possível registrar pagamentos parciais sucessivos, com data, usuário responsável e saldo restante.
- O gerente do evento pode consultar os fechamentos; somente administradores podem criar lotes e dar baixa em pagamentos.

## Pré-visualização do PDF Digital — versão 5.8.25

- Adicionado um card de pré-visualização real do PDF acima da prévia térmica.
- A prévia acompanha logo, modelo, cores e tamanhos configurados no PDF Digital.
- Os dois cards permanecem empilhados na coluna direita, sem alterar a lógica térmica.

## Tamanhos configuráveis do ingresso PDF — versão 5.8.24

- A configuração do PDF agora permite aumentar ou diminuir a logo.
- Foram adicionados controles independentes para o título, nome do evento, textos e dados principais.
- As medidas são salvas no evento e aplicadas aos quatro modelos do PDF sem alterar o ingresso térmico.

## Modelos aprovados do ingresso PDF — versão 5.8.23

- Os três modelos extras foram substituídos pelos layouts aprovados: Recortes laterais, Destacável moderno e Faixa elegante.
- O modelo Padrão atual foi preservado e recebeu o mesmo cabeçalho corrigido dos demais.
- A logo do PDF ficou maior, centralizada, proporcional e protegida das bordas; o título e o nome do evento foram reposicionados sem sobreposição.
- Nomes de evento longos são reduzidos e organizados automaticamente em até duas linhas dentro do cabeçalho.
- A opção Destacável moderno adapta logos claras para o cabeçalho branco sem perder a identidade visual.

## Rodapé térmico mais legível — versão 5.8.22

- O ingresso impresso agora mostra apenas `Nome do usuário | data e hora`, sem o texto “Gerado por:”.
- A informação continua em uma única linha e recebeu fonte maior e mais forte para melhorar a leitura na impressão térmica.
- O ingresso PDF digital não foi alterado.

## Logo e modelos do ingresso PDF — versão 5.8.21

- A configuração do ingresso agora permite enviar, trocar ou remover uma logo exclusiva para o PDF digital de cada evento.
- O visual atual continua selecionado como padrão e foram adicionados os modelos Borda dupla, Ingresso recortado e Moldura tracejada.
- A logo mantém sua proporção, aparece centralizada junto ao nome do evento e as escolhas ficam salvas no Firebase.
- A pré-visualização da configuração responde imediatamente à troca de logo e de modelo.

## Identificação da geração em uma linha — versão 5.8.20

- O nome do usuário e a data/hora de geração agora aparecem juntos em uma única linha no rodapé.
- O mesmo padrão foi aplicado ao ingresso térmico e ao PDF digital.
- Em papel de 58 mm, o texto usa tamanho compacto próprio para permanecer em uma linha.

## Margem de corte restaurada — versão 5.8.19

- Restaurados os 5 mm completamente livres depois de cada ingresso e antes da marca de corte.
- A linha grossa tracejada e a tesoura em SVG ficam em uma faixa própria após essa margem.
- A altura física da página impressa considera os 5 mm livres e a faixa de corte, sem sobreposição ao ingresso seguinte.

## Linha de corte reforçada — versão 5.8.18

- A linha de corte entre ingressos térmicos ficou mais grossa, preta, tracejada e ocupa toda a largura útil.
- O antigo caractere de tesoura foi substituído por um desenho vetorial SVG maior, próprio para impressão.
- O espaçamento físico de 5 mm entre os ingressos foi preservado.

## Link de validação na planilha da Portaria — versão 5.8.17

- A exportação completa da Portaria agora inclui a coluna `LINK DE VALIDAÇÃO`.
- Cada participante com QR Code já gerado recebe seu próprio endereço `#validar=...`.
- Ingressos ainda não gerados permanecem com a célula do link vazia.
- Nas reservas de mesas e bistrôs, o link é associado individualmente ao ocupante correto.

## Data e horário do evento — versão 5.8.16

- O cadastro e a edição do evento agora possuem um campo obrigatório de horário ao lado da data.
- O horário fica salvo no evento e aparece nos resumos, cartões, relatórios, ingressos digitais, impressão térmica e eventos arquivados.
- Eventos antigos continuam compatíveis e podem receber o horário na próxima edição.

## Página dedicada para usuários — versão 5.8.15

- A área Mais possui um novo acesso para Gerenciar usuários, visível somente aos administradores.
- Cadastro, perfis, permissões por evento, bloqueio, redefinição de senha e exclusão agora ficam em uma página própria.
- O antigo diálogo de usuários foi removido, mantendo todas as funções administrativas existentes.
- A nova página foi adaptada para computador e celular.

## Configurações independentes por impressora — versão 5.8.14

- Os modelos térmicos de 58 mm e 80 mm agora são armazenados separadamente em cada evento.
- Trocar a largura carrega apenas as medidas, logo, textos e opções salvas para aquela impressora.
- A tela começa bloqueada e possui um cadeado aberto/fechado para liberar ou proteger a edição contra alterações acidentais.
- A impressão aplica automaticamente a configuração correspondente à largura escolhida no diálogo.

## Identificação da geração dos ingressos — versão 5.8.13

- Ao gerar um ingresso, o sistema grava junto ao QR Code o usuário, a data e a hora exatos da geração.
- O PDF digital e a impressão térmica exibem essas informações no rodapé de cada ingresso.
- Os dados permanecem imutáveis enquanto o ingresso existir; somente excluir e gerar novamente cria um novo registro de geração.
- As regras do Firebase validam e impedem a alteração isolada desses dados depois que foram gravados.

## Separação física dos ingressos e tema claro — versão 5.8.12

- Impressões com dois ou mais ingressos recebem uma faixa física de 5 mm após cada ingresso.
- A faixa possui uma linha de corte fina e tracejada com uma pequena tesoura, facilitando o corte manual.
- O tamanho configurado do ingresso foi preservado; os 5 mm são acrescentados depois dele e não comprimem o conteúdo.
- O modo escuro e seu botão foram removidos; o painel agora utiliza somente o tema claro.

## Permanência da página após atualizar — versão 5.8.11

- Atualizar o navegador mantém o evento selecionado e a área atual, como Vendas, Mesas, Portaria ou Configuração do ingresso.
- Um login novo ou a entrada após desconectar continua abrindo a página inicial de eventos.
- A restauração aguarda os dados do Firebase chegarem antes de validar o evento, evitando voltar para o início durante a conexão.

## Tamanho do botão Trocar evento — versão 5.8.10

- O botão `Trocar evento` voltou às dimensões compactas da versão 5.8.7.
- A cor atual foi preservada; somente largura, altura, fonte e espaçamento foram restaurados.

## Impressão simplificada — versão 5.8.9

- O botão `IMPRIMIR` usa amarelo com texto dourado-escuro em vendas individuais e reservas de mesas/bistrôs.
- A altura do ingresso não é mais escolhida novamente ao imprimir: a impressão usa a medida salva na Configuração do ingresso.
- O seletor desabilitado de impressora foi removido. A impressora real é escolhida no diálogo oficial do navegador após clicar em `Abrir impressão`.

## Botões responsivos e padronizados — versão 5.8.8

- `Trocar evento` agora segue o padrão dos botões secundários e ocupa a largura disponível no celular, como os botões de Excel.
- Ações de ingresso usam duas colunas no computador e no celular, evitando cortes em `IMPRIMIR` e `Excluir ingresso`.
- Botões de ingresso, venda, reservas e exportação compartilham altura, alinhamento e tratamento de textos, preservando as cores de cada função.

## Mesas persistentes e Excel da Portaria — versão 5.8.7

- Reservas de mesas e bistrôs permanecem detalhadas e na mesma posição após gerar, excluir ou alterar ingressos e pagamentos.
- O pagamento das reservas voltou a ser alterado diretamente pelo botão `Pendente` ou `Pago`, como nas vendas individuais.
- A Portaria ganhou um Excel completo com participantes individuais, ocupantes de mesas e bistrôs, pagamentos, QR Codes e situação/data de cada check-in na mesma planilha.

## Nomenclatura das ações de venda — versão 5.8.6

- Vendas individuais, mesas e bistrôs agora usam os mesmos textos: `Editar venda` e `Excluir venda`.
- A padronização também aparece nas listas completas e na edição da reserva.

## Altura configurável da impressão — versão 5.8.5

- A altura de cada ingresso térmico agora pode ser escolhida entre 80 mm e 140 mm, em intervalos de 5 mm.
- A altura escolhida na Configuração do ingresso fica salva no evento e aparece como padrão ao abrir a impressão.
- O diálogo de impressão também permite alterar a altura apenas para aquela impressão.
- Pré-visualização e página térmica usam a mesma altura, sem barras de rolagem internas no ingresso.

## Detalhes e ações do ingresso — versão 5.8.4

- As funções do ingresso ficam agrupadas antes das ações gerais da venda.
- Editar e Excluir aparecem juntos no final dos detalhes, lado a lado.
- Gerar um ingresso não baixa mais o PDF automaticamente e mantém o participante expandido na mesma posição da tela.

## QR Code térmico configurável — versão 5.8.3

- O QR Code da impressão térmica pode ser configurado de 18 mm até 40 mm.
- O novo controle de espaço antes do QR Code move o código para cima ou para baixo e fica salvo no evento.
- A impressão respeita diretamente os tamanhos e espaçamentos configurados, sem reduções automáticas invisíveis.

## Abertura na página inicial — versão 5.8.2

- Ao conectar ou reconectar ao Firebase, o painel sempre abre na seleção de eventos.
- O último evento acessado não é mais restaurado entre sessões; links diretos de validação por QR Code continuam preservados.

## PDF restaurado — versão 5.8.1

- O PDF voltou ao mesmo visual da versão 5.7.2, no formato vertical de 90 × 160 mm.
- A alteração é exclusiva do PDF; impressão térmica, QR Code, validação e demais recursos permanecem iguais.

## Ingresso térmico compacto — versão 5.8.0

- PDF e impressão pelo navegador usam páginas independentes de 80 mm de altura, nas larguras de 58 mm ou 80 mm.
- A página `Mais > Configuração do ingresso`, exclusiva para administradores, permite ajustar logo, largura, fontes, espaçamento, QR Code, margens e informações opcionais.
- A pré-visualização usa o mesmo gerador HTML da impressão térmica e é atualizada em tempo real.
- Logos PNG e JPG são redimensionadas proporcionalmente no navegador antes de serem salvas no evento.
- Conteúdos maiores recebem automaticamente uma composição mais compacta para preservar QR Code, código e informações dentro dos 80 mm.

## Tempo do Toast — versão 5.7.2

- Os avisos temporários permanecem visíveis durante 5 segundos.

## Toast responsivo — versão 5.7.1

- Mantém os avisos temporários inteiramente dentro da viewport em computadores, tablets e celulares.
- Respeita a área segura inferior do aparelho e limita a largura com 16 px de margem lateral em telas estreitas.
- Permite quebra de linha e crescimento automático para mensagens longas, sem alterar o visual nem a duração dos avisos.

## Impressão térmica real — versão 5.7.0

- Ingressos gerados podem ser impressos em layout térmico de 58 mm ou 80 mm.
- A escolha da impressora acontece no diálogo nativo do navegador e do sistema operacional.
- Cada ingresso imprime apenas evento, participante, modalidade, tipo, reserva, valor, pagamento, QR Code e código de validação.
- O transporte de impressão possui ponto de integração opcional para um futuro aplicativo auxiliar (`window.leBeefPrintBridge.printHtml`).

## Modal de mesa responsivo — versão 5.6.1

- O diálogo de mesa ocupada respeita margens mínimas no desktop e no celular.
- A altura é limitada pela viewport e o conteúdo passa a ter rolagem interna quando necessário.
- Cabeçalho, botão de fechar, aviso e ação de liberar a mesa permanecem contidos no modal.

## Ingressos identificados e auditáveis — versão 5.6.0

- Nomes dos convidados são sugeridos automaticamente como `Roberto/Convidado-2`, mantendo todos os campos editáveis.
- Telefone passou a ser opcional nas vendas e reservas, com lembrete sobre o envio pelo WhatsApp.
- PDFs e QR Codes somente podem ser gerados após a confirmação do pagamento.
- Ingressos identificam a modalidade individual, mesa ou bistrô, inclusive na validação da portaria.
- Geração e exclusão dos ingressos aparecem no histórico de auditoria com o usuário responsável.
- A tela “Ver todas” das reservas oferece as mesmas ações de ingresso da visualização principal.

## Portaria em fluxo contínuo — versão 5.5.1

- Após confirmar um QR lido pelo scanner, a câmera reabre automaticamente para receber o próximo participante.
- O horário gravado corresponde ao momento em que o QR foi lido e aparece com data e hora quando um ingresso já utilizado é escaneado novamente.
- Resultados inválidos ou já usados oferecem o botão “Ler próximo QR Code”.

## Ciclo do ingresso gerado — versão 5.5.0

- Antes da emissão aparece somente “Gerar ingresso em PDF”; depois, aparecem “Ver ingresso”, “Enviar ingresso” e “Excluir ingresso”.
- Excluir exige confirmação, invalida o QR antigo e permite emitir um novo em caso de perda ou roubo; ingressos que já tiveram check-in não podem ser excluídos.
- O envio permite compartilhar o PDF anexado escolhendo aplicativo e destinatário, ou baixar o PDF e abrir WhatsApp normal/Business no número cadastrado.
- Cada página do PDF exibe conteúdo centralizado, valor individual e situação do pagamento.

## Permissão da câmera e alertas sonoros — versão 5.4.1

- Antes de abrir o leitor, a Portaria exibe uma orientação para autorizar a câmera no Android ou navegador.
- Se a permissão estiver bloqueada, o diálogo explica que ela precisa ser liberada nas configurações do aplicativo ou site.
- A leitura válida emite um som positivo; QR inválido ou já utilizado emite um som de recusa e uma vibração diferente em celulares compatíveis.

## Leitor de QR Code na Portaria — versão 5.4.0

- A Portaria pode abrir a câmera traseira do celular e ler o QR Code do ingresso em tempo real.
- Após a leitura, o sistema informa se o ingresso é válido, inválido ou já utilizado e só então permite confirmar o check-in.
- Também é possível escolher uma foto do QR Code quando a câmera estiver indisponível ou bloqueada.

## Ajuste visual da ocupação sem venda — versão 5.3.1

- Mesa ou bistrô ocupado sem venda agora usa no mapa o mesmo estado visual laranja de uma reserva.
- O marcador não exibe moldura roxa nem etiqueta especial, mas continua fora de vendas, faturamento, relatórios e Excel.

## QR Code, check-in individual e ingresso em PDF — versão 5.3.0

- Cada ingresso vendido recebe um QR Code único; nas reservas, cada ocupante recebe o próprio código.
- O QR abre a validação da Portaria, identifica códigos inválidos ou já utilizados e confirma a entrada individualmente.
- O PDF usa formato vertical compacto de 90 × 160 mm, otimizado para celular, com um ingresso por página.
- Administradores e gerentes podem personalizar título, mensagem e cores do ingresso na configuração do evento.
- Os botões “QR em PDF” e “Enviar ingresso” ficam dentro dos detalhes da venda ou reserva. No celular, “Enviar ingresso” usa o compartilhamento do sistema para escolher WhatsApp ou WhatsApp Business.
- A regra do Firebase foi ampliada para permitir que o perfil Portaria atualize somente a validação do QR Code e o check-in correspondente.

Site estático em HTML, CSS e JavaScript, pronto para publicar no GitHub Pages, com Firebase Authentication e Realtime Database.

## Ocupação de mesas sem venda — versão 5.2.0

Ao abrir uma mesa ou bistrô livre, use **Ocupar sem venda** para deixá-lo indisponível no mapa sem criar faturamento. A ocupação aparece em roxo, entra somente no contador de móveis ocupados e pode ser removida tocando novamente na mesa e escolhendo **Liberar mesa**. Ela não aparece nas vendas, reservas, participantes, portaria, Excel, estoque ou relatórios financeiros. Administradores, gerentes do evento e vendedores podem ocupar e liberar. As regras do Firebase permanecem iguais.

## Arquivamento — versão 5.1.0

Na tela inicial, Eventos arquivados abre a lista de eventos encerrados. Em Mais, administradores e gerentes do evento podem arquivar manualmente ou restaurar. Vendas, reservas e relatórios são preservados.

O arquivamento automático é calculado pela data: um evento em 13/09 é arquivado a partir de 14/09 às 23h59 no horário de Brasília. A classificação é aplicada ao carregar o painel e durante seu uso, sem tarefa agendada no servidor. O arquivamento manual e a restauração são salvos no Firebase. Restaurar suspende a classificação automática para a data atual do evento; alterar essa data reativa o prazo automático. Não há novas regras de banco a publicar nesta versão.

## Login individual, permissões e histórico

## Navegação por páginas — versão 5.0.0

A tela inicial mostra somente os eventos. Ao selecionar um, navegue por Resumo, Vendas, Mesas e Mais. No celular, a navegação fica fixa na parte inferior; no computador, fica na lateral. Mesas aparece somente em eventos com mapa ativo.

Em Mais ficam Portaria, Financeiro, Histórico e as configurações permitidas para o perfil. A Portaria reúne a busca e os check-ins de vendas avulsas e ocupantes das mesas. As pesquisas de vendas e reservas permanecem ao trocar de página. Use Trocar evento para retornar à seleção. Os arquivos pages.js e pages.css devem ser enviados junto com o restante do pacote.

A versão 4.11.0 adiciona desconto individual por cadeira nas reservas de mesas e bistrôs. O desconto pode ser informado em porcentagem ou em reais para cada ocupante, recalcula o total automaticamente, permanece salvo na edição e aparece no Excel das reservas.

Nas reservas, a primeira pessoa é a responsável e informa nome e telefone. Os demais ocupantes precisam somente do nome. O total é calculado automaticamente pelo valor por pessoa/cadeira definido no evento. As reservas entram no faturamento, no fechamento por vendedor, no histórico e na planilha Excel.

- **Administrador**: visualiza todos os eventos e controla usuários, eventos, vendas, pagamentos, check-in, Excel e relatório financeiro.
- **Gerente do evento**: administra somente os eventos atribuídos, podendo editar configurações, controlar vendas e reservas, pagamentos, check-in, Excel, relatório financeiro e histórico. Não cria/exclui eventos nem gerencia usuários.
- **Vendedor**: visualiza somente os eventos marcados pelo administrador; nesses eventos, trabalha com vendas, pagamentos, check-in e Excel.
- **Portaria**: visualiza somente os eventos marcados pelo administrador; nesses eventos, consulta participantes e realiza check-in.

As permissões são aplicadas na interface e nas regras do Realtime Database. Consulte [FIREBASE-SETUP.md](FIREBASE-SETUP.md) antes de publicar esta versão.

## Publicar no GitHub Pages

1. Envie todos os arquivos desta pasta para o repositório no GitHub.
2. Abra **Settings > Pages**.
3. Em **Build and deployment**, selecione **Deploy from a branch**, a branch `main` e a pasta `/(root)`.
4. Salve e aguarde a atualização do endereço público.

## Atualização obrigatória no Firebase

Na atualização para a versão 5.0.0, envie todos os arquivos do pacote ao GitHub Pages. As regras do Firebase continuam iguais às da versão 4.9.0; publique `database.rules.json` somente se ainda não tiver aplicado aquela atualização. Eventos, vendas e reservas antigas continuam disponíveis normalmente.

As instruções completas estão em [FIREBASE-SETUP.md](FIREBASE-SETUP.md).

## Instalar como aplicativo

No endereço HTTPS do GitHub Pages, o botão **Instalar app** permite instalar o painel no Android e no computador. No iPhone/iPad, use **Compartilhar > Adicionar à Tela de Início** no Safari.

## Estrutura de dados

```text
users/{uid}       → nome, e-mail, perfil, situação e eventIds permitidos
events/{eventId}  → evento, data, local, tipos/lotes e pacotes promocionais
sales/{saleId}    → participante, contato, ingressos avulsos/pacotes, quantidades, valor, forma/data do pagamento, vendedor e check-in
auditLogs/{logId} → ação, venda, participante, usuário, perfil, data e horário
```

## Recursos principais

- Eventos com tipos/lotes, valores e quantidades independentes.
- Uma única venda pode reunir vários tipos de ingresso e quantidades separadas para o mesmo participante.
- Pacotes promocionais com composição de ingressos, desconto percentual e baixa automática no estoque individual.
- Participantes, pagamentos e check-in em tempo real.
- Busca e filtros combinados.
- WhatsApp normal ou Business.
- Exportação Excel por evento.
- Relatório financeiro dedicado.
- Fechamento por vendedor e período.
- Forma e data do pagamento na tela e na planilha Excel.
- PWA adaptado ao computador e celular.
- Login individual e acesso restrito aos eventos escolhidos pelo administrador.
- Histórico administrativo de criações, edições, exclusões, pagamentos e check-ins.

Ao abrir `index.html` diretamente no computador, o painel usa o modo local de demonstração. O login seguro e o banco compartilhado funcionam no site hospedado.

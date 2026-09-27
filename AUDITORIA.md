# Auditoria técnica — Le Beef 6.0.22

Data: 26/09/2026. Base analisada: pacote completo 6.0.21.

O layout, a estrutura HTML das páginas, as cores, fontes, medidas, posições, textos dos controles e funcionalidades atuais foram preservados. A única alteração de texto visível no site é o número da versão no rodapé. Não houve publicação no site nem alteração de dados no Firebase.

## 1. Escopo e relações verificadas

Foram inventariados os 63 arquivos da versão atual: 14 JavaScripts, 31 folhas CSS, 3 páginas HTML, 11 imagens, 2 arquivos de regras, manifesto e README. Foram cruzados imports, URLs locais, imagens, referências do manifesto/cache, IDs estáticos e gerados, seletores, formulários, eventos e funções.

| Área | Relação principal e resultado |
| --- | --- |
| Painel | `index.html` carrega `app.js`, exportador Excel, instalação PWA e os estilos. `pages.js` cria a navegação e move componentes para as páginas atuais. Esses componentes não são lixo apenas por terem origem em um modal antigo. |
| Dados e acesso | `app.js` usa Firebase Auth e Realtime Database, com assinaturas por perfil/evento. `firebase-config.js` e os dois arquivos de regras foram mantidos byte a byte. |
| Vendas e reservas | Formulários, etapas, estoque, pacotes, descontos, pagamento, ocupação sem venda, histórico e check-in permanecem no código atual. |
| Ingressos | `ticket-tools.js` gera PDF/QR; `qr-scanner-tools.js` lê QR; `thermal-print.js` e `ticket-layout.js` montam impressão. Bibliotecas empacotadas têm uso real e foram preservadas integralmente. |
| Financeiro | `financial-core.js`, relatórios em `app.js` e o exportador Excel continuam ativos. As fórmulas similares do servidor não foram unificadas, pois atendem a ambientes diferentes. |
| Link público | `ingresso.html` → `ingresso.js` → leitura individual de `ticketLinks`. Links inválidos são tratados. |
| Compra online | `comprar.html` está em “Em breve” e não carrega `online-store.js`. O código de pagamento foi preservado, mas seu download antecipado pelo cache foi retirado. |
| Backend | Foram lidos o código e a configuração disponíveis em `versao-6.0.6/functions`, inclusive OAuth, pedidos, webhook, estoque, expiração e limpeza da conexão. É um retrato local anterior; não foi presumido que corresponda exatamente ao backend publicado. Seus quatro testes existentes passaram. |

Não foram encontrados imports sem uso nos módulos ativos, nomes de funções chamadas sem definição nos fluxos ativos analisados, arquivos locais ausentes nas referências operacionais ou IDs duplicados no DOM testado. As referências a IDs inexistentes concentram-se no código de compra online desativado. O renderizador correspondente retorna imediatamente quando seu formulário não existe.

## 2. O que foi encontrado e removido

Foram removidas 35 ocorrências de seletores CSS sem componentes correspondentes, após conferir HTML, templates JavaScript e classes dinâmicas. Seletores agrupados tiveram somente a parte sem uso retirada; declarações, ordem e contexto dos seletores restantes foram preservados.

| Arquivo | Remoção segura | Seletores removidos |
| --- | --- | ---: |
| `auth-permissions.css` | Classe do antigo modal de gerenciamento de usuários | 1 |
| `layout.css` | Grade antiga `.content-grid`; a regra ativa de painel oculto permanece | 1 |
| `promoters.css` | Campo antigo `.sale-promoter-field` | 1 |
| `sales.css` | Antigos botões `.download-button`, `.event-delete`, `.event-export` e `.event-sale` | 8 |
| `styles.css` | Grade antiga `.content-grid` e sua variante responsiva | 2 |
| `table-map.css` | Exclusão/redimensionamento antigos do editor e classe antiga de ações da reserva | 10 |
| `ticketing.css` | Editor antigo `.ticket-design-settings`, `.ticket-design-grid` e `.ticket-design-preview` | 12 |

Outras remoções:

- Parâmetro `eventSales` de `renderPlatformSettlements` e o argumento na chamada: a função já obtém as vendas pelo evento selecionado e nunca utilizava esse parâmetro.
- `pwa-icon-1024.png` no novo pacote: nenhum HTML, JavaScript, CSS, manifesto ou cache o referencia. Os ícones de 192 e 512 pixels continuam presentes.
- Entrada de pré-cache de `online-store.js?v=2`: nenhuma página atual carrega esse script. O arquivo continua disponível no pacote por pertencer à integração de pagamento.

Nenhuma função de negócio, biblioteca, import ativo ou elemento da estrutura HTML foi removido. A redução do conteúdo operacional é de aproximadamente 68 KB, principalmente pelo ícone sem referência. O relatório adicionado não participa do carregamento do site.

## 3. Arquivos alterados, adicionados e excluídos

Alterados — 11 arquivos:

- `app.js`
- `auth-permissions.css`
- `index.html`
- `layout.css`
- `promoters.css`
- `README.md`
- `sales.css`
- `service-worker.js`
- `styles.css`
- `table-map.css`
- `ticketing.css`

Adicionado: `AUDITORIA.md`, este relatório.

Excluído apenas da nova distribuição: `pwa-icon-1024.png`. O arquivo original continua recuperável na pasta e no ZIP da versão 6.0.21.

Em `index.html`, apenas as revisões das URLs dos arquivos alterados e o número da versão foram atualizados. Nenhum componente foi reposicionado ou reestruturado.

## 4. Problemas técnicos simples corrigidos

- O pré-cache usava os ícones de 512 pixels sem `?v=19`, enquanto o manifesto pedia URLs com esse sufixo. As entradas agora correspondem exatamente ao manifesto.
- O script de compra online desativado deixou de ser baixado desnecessariamente na instalação do cache.
- Links operacionais do README apontavam para `FIREBASE-SETUP.md`, ausente do pacote, e uma instrução antiga indicava `database.rules.json`. As orientações atuais apontam para `regras-firebase-completas.json`, que existe neste pacote. O histórico foi identificado como histórico de versões anteriores.
- O cache da versão foi atualizado para distribuir a limpeza e os recursos correspondentes.

## 5. O que foi mantido e por quê

- Todos os estilos de mapa/reservas que ainda se aplicam, inclusive arquivos de ajustes sucessivos. A ordem da cascata altera o visual; não foram fundidos ou reordenados.
- Classes dinâmicas como `audit-created`, `audit-deleted`, `audit-payment`, `audit-checkin` e `kind-table`. Não aparecem necessariamente como palavras completas no JavaScript, mas são geradas em execução.
- Seletores com `:not(.table-reservation-actions)`: continuam afetando elementos existentes mesmo que a classe negada não seja usada.
- Código e estilos da integração online, incluindo `saveOnlineSalesSettings`, `connectMercadoPagoAccount` e `online-store.js`. Os dois primeiros estão sem chamadas no painel atual e dependem de um formulário ausente; foram registrados como código inativo, mas preservados por integrarem o fluxo de pagamento que o pedido proíbe eliminar.
- Conversores de dados antigos, tratamento de arrays/objetos do Firebase e campos legados de ingressos. Podem ser necessários para vendas e configurações já salvas.
- Bibliotecas de PDF e leitura de QR, suas funções internas e licenças. Não foram desmontadas por análise superficial de nomes.
- Os parâmetros `_` de callbacks que acessam o índice e o nome local `sync` da função retornada em `pages.js`: não são funções abandonadas.
- As regras completas e o fragmento `regras-ticket-links.json`: são dois formatos de aplicação das mesmas regras, não cópias descartáveis.
- Pastas antigas, backups, `work` e `tmp` do espaço de trabalho. Não fazem parte do pacote publicado. Não foram apagadas em massa, pois contêm fontes, testes úteis, evidências e versões recuperáveis. O pacote de produção não continha testes ou temporários abandonados.

## 6. Problemas preexistentes registrados, sem alteração nesta limpeza

1. **Relatório financeiro em tablet:** o documento apresenta transbordamento horizontal em 768 px, tanto antes quanto depois da limpeza. Corrigir isso exigiria alterar a disposição visual, proibida neste pedido.
2. **Exclusão por promoter:** `hasRole` trata promoter como vendedor em ações do painel, incluindo a exclusão de ingresso/venda. A regra de exclusão de um registro existente em `ticketLinks` autoriza admin, gerente ou vendedor, mas não promoter. Portanto, essa operação pode ser recusada quando há link salvo. A divergência foi confirmada por leitura cruzada e avaliação local da condição da regra; corrigir exige uma decisão de permissão e não é remoção de código morto. Nenhuma permissão foi alterada.
3. **Compra online não liberada:** a página atual é informativa. Reconectar o script sem restaurar os seus formulários e SDK externo causaria referências a elementos ausentes. Não houve tentativa de ativar essa funcionalidade.

## 7. Segunda verificação e resultado

Após a limpeza:

- Os 14 JavaScripts passaram na verificação de sintaxe; os JSONs e as regras foram lidos e comparados.
- Referências locais do HTML, imports, imagens CSS e entradas do cache foram verificadas novamente: nenhum caminho operacional ausente.
- A estrutura HTML original foi comparada por conteúdo, desconsiderando somente a versão e as revisões das URLs: preservada.
- O CSS restante foi comparado por seletor, contexto e declarações: conteúdo e ordem preservados, sem novas cores, fontes, medidas ou posições.
- Foram comparados 90 estados de páginas e modais em 390, 768 e 1366 px, nos temas claro e escuro. Não houve diferença visual significativa nem mudança de dimensões. Data, URL do QR, animações e rodapé de versão foram normalizados somente no ambiente de teste. A comparação tolerou diferença de 1/255 por canal na suavização de textos e considerou a área visível para modais.
- Não houve erro de JavaScript, erro de console ou resposta 404 nos cenários ativos exercitados no navegador.

Fluxos exercitados com dados locais e adaptadores de teste:

- Navegação por resumo, vendas, mesas, portaria, opções, histórico, financeiro, configuração, usuários, promoters e aviso de venda online.
- Venda individual pelas três etapas e preservação de filtros ao navegar.
- Reserva com convidados, pagamento, quarta etapa e geração dos QR Codes.
- Reserva pendente sem emissão e confirmação posterior de pagamento.
- Ocupação e liberação de bistrô sem venda/nome do comprador.
- Geração de PDF e montagem da impressão de 58 e 80 mm.
- Leitura de um QR gerado pela biblioteca do próprio projeto.
- Check-in individual e por ocupante da mesa.
- Restrições de interface dos cinco perfis; promoter sem controle de check-in.
- Abertura das opções de envio e disponibilidade da opção de número cadastrado.
- Exclusão com envio conjunto de `sales/.../qrTickets: null` e `ticketLinks/...: null` ao adaptador Firebase.
- Fechamento de comissão e baixa integral do pagamento.
- Exportação XLSX de vendas, reservas e check-ins, com verificação do arquivo gerado.
- Alteração/salvamento do cabeçalho PDF, edição do evento, arquivamento/restauração e persistência após recarregar.
- Links públicos válidos/inválidos com resposta Firebase simulada.
- Tratamento de credencial de login recusada com Firebase Auth simulado.
- Instalação do cache PWA e presença dos ícones necessários.
- Quatro testes existentes do núcleo de pagamento: taxas, comissão, estoque/expiração e nomes de participantes.

Limites da verificação: não foram usados usuários reais, criadas contas reais, realizados pagamentos ou enviados ingressos a terceiros. Login bem-sucedido, criação de contas, regras efetivamente publicadas, webhooks, câmera física, impressão em equipamento e o seletor nativo do WhatsApp não foram certificados em produção. Não houve implantação de regras nem de Cloud Functions. As evidências e ferramentas da revisão ficaram em `work/audit-v6`, fora do pacote do site.

**Confirmação final:** layout e estrutura visual originais preservados. A limpeza não exige novas regras do Firebase em relação à versão 6.0.21.

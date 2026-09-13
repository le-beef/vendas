# Le Beef — painel de vendas de ingressos

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

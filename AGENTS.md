# AGENTS.md

Este repositório adota documentação bilíngue (PT-BR e inglês), mas cada arquivo deve manter consistência de idioma internamente.

## Objetivo deste guia

Evitar falhas recorrentes de escrita, redundâncias e lacunas de referência na documentação técnica.

## Checklist editorial obrigatório

1. **Clareza e objetividade**
   - Evite frases longas e repetitivas.
   - Prefira instruções acionáveis com comandos curtos e verificáveis.

2. **Consistência terminológica**
   - Use os mesmos nomes de diretórios/scripts em todo o texto (`web/`, `worker/`, `shared/`, `npm run ...`).
   - Não alternar termos equivalentes sem necessidade (ex.: "front-end" vs "frontend").

3. **Referências completas**
   - Sempre que mencionar um fluxo relevante, apontar para o artefato correspondente em `docs/` quando existir.
   - Ao citar variáveis de ambiente e comandos, manter correspondência exata com os arquivos fonte (`package.json`, `wrangler.toml`).

4. **Evitar redundância**
   - Não duplicar o mesmo passo em seções diferentes sem acrescentar contexto.
   - Consolidar troubleshooting repetido em um único bloco.

5. **Qualidade linguística**
   - Corrigir ortografia, concordância e pontuação.
   - Manter estilo técnico direto, sem ambiguidade.

## Escopo

Estas diretrizes se aplicam a toda a árvore do repositório.

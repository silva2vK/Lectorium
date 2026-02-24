
import React, { useState, useEffect } from 'react';
import { 
  X, BookOpen, FileText, Workflow, Cloud, 
  WifiOff, CheckSquare, MousePointerClick, 
  Touchpad, AlertTriangle, ShieldCheck,
  CheckCircle2, Pen, Highlighter, ArrowRight,
  Globe, Chrome, Compass, Flame, Shield, Zap, 
  Layers, Disc, Smartphone, ArrowLeft, Wrench, RefreshCw, AlertCircle,
  Cpu, Terminal, Battery
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isMandatory?: boolean;
}

const SECTIONS = [
  {
    id: 'intro',
    title: 'Acesso e Google Drive',
    icon: Cloud,
    content: (
      <div className="space-y-6">
        <div className="bg-brand/10 p-4 rounded-xl border border-brand/20">
          <h3 className="text-lg font-bold text-white mb-2">Por que pedimos permissão 2 vezes?</h3>
          <p className="text-sm text-gray-300">
            O Lectorium não tem servidor próprio. Seus arquivos ficam salvos diretamente no <strong>seu Google Drive</strong>.
            Para isso funcionar, precisamos de duas chaves separadas:
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex gap-4 items-start bg-[#2c2c2c] p-4 rounded-xl border border-gray-700">
            <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400 font-bold">1</div>
            <div>
              <strong className="text-white block">Login (Identidade)</strong>
              <p className="text-xs text-gray-400">Para sabermos seu nome e foto.</p>
            </div>
          </div>

          <div className="flex gap-4 items-start bg-[#2c2c2c] p-4 rounded-xl border border-yellow-500/30">
            <div className="bg-yellow-500/20 p-2 rounded-lg text-yellow-500 font-bold">2</div>
            <div>
              <strong className="text-white block flex items-center gap-2">
                Acesso aos Arquivos <AlertTriangle size={14} className="text-yellow-500"/>
              </strong>
              <p className="text-xs text-gray-400 mt-1">
                Esta é a parte crítica. Uma tela do Google aparecerá pedindo para "Ver, editar, criar e excluir arquivos".
              </p>
              <div className="mt-3 bg-black/40 p-3 rounded border border-gray-600">
                <div className="flex items-center gap-2 text-green-400 text-xs font-bold mb-1">
                  <CheckSquare size={14} /> O QUE VOCÊ DEVE FAZER:
                </div>
                <p className="text-xs text-gray-300">
                  Você <strong>PRECISA marcar todas as caixas de seleção</strong> nessa tela. Se você não marcar, o Lectorium não conseguirá salvar nada e dará erro.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'browsers',
    title: 'Navegadores',
    icon: Globe,
    content: (
      <div className="space-y-6">
        <h3 className="text-lg font-bold text-white mb-2">Tier List de Performance</h3>
        <p className="text-sm text-gray-300">
          O Lectorium usa tecnologias avançadas (WebAssembly, File System Access API). 
          Sua experiência depende do motor do seu navegador.
        </p>

        <div className="space-y-4">
          
          {/* TIER S */}
          <div className="bg-[#1a1a1a] border border-green-500/30 rounded-xl overflow-hidden">
            <div className="bg-green-500/10 p-3 flex justify-between items-center border-b border-green-500/20">
              <span className="text-green-400 font-bold text-sm">TIER S (Recomendado)</span>
              <span className="text-[10px] text-green-400/80 bg-green-900/30 px-2 py-0.5 rounded">Chromium Desktop</span>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 bg-[#252525] p-2 rounded-lg border border-[#333]">
                <Chrome size={20} className="text-blue-400" /> <span className="text-sm text-white">Google Chrome</span>
              </div>
              <div className="flex items-center gap-3 bg-[#252525] p-2 rounded-lg border border-[#333]">
                <Shield size={20} className="text-orange-400" /> <span className="text-sm text-white">Brave</span>
              </div>
              <div className="flex items-center gap-3 bg-[#252525] p-2 rounded-lg border border-[#333]">
                <Zap size={20} className="text-cyan-400" /> <span className="text-sm text-white">Microsoft Edge</span>
              </div>
              <div className="flex items-center gap-3 bg-[#252525] p-2 rounded-lg border border-[#333]">
                <Layers size={20} className="text-red-400" /> <span className="text-sm text-white">Vivaldi</span>
              </div>
            </div>
            <div className="px-4 pb-3">
              <p className="text-[10px] text-gray-500 mt-2 flex items-center gap-1">
                <CheckCircle2 size={10} className="text-green-500"/> Edição de arquivos locais sem re-upload.
              </p>
            </div>
          </div>

          {/* TIER A */}
          <div className="bg-[#1a1a1a] border border-blue-500/30 rounded-xl overflow-hidden">
            <div className="bg-blue-500/10 p-3 flex justify-between items-center border-b border-blue-500/20">
              <span className="text-blue-400 font-bold text-sm">TIER A (Excelente)</span>
              <span className="text-[10px] text-blue-400/80 bg-blue-900/30 px-2 py-0.5 rounded">Mobile & Alternativos</span>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 bg-[#252525] p-2 rounded-lg border border-[#333]">
                <Smartphone size={20} className="text-purple-400" /> <span className="text-sm text-white">Samsung Internet</span>
              </div>
              <div className="flex items-center gap-3 bg-[#252525] p-2 rounded-lg border border-[#333]">
                <Disc size={20} className="text-red-500" /> <span className="text-sm text-white">Opera</span>
              </div>
              <div className="flex items-center gap-3 bg-[#252525] p-2 rounded-lg border border-[#333]">
                <Smartphone size={20} className="text-yellow-400" /> <span className="text-sm text-white">Soul Browser</span>
              </div>
            </div>
          </div>

          {/* TIER B */}
          <div className="bg-[#1a1a1a] border border-yellow-600/30 rounded-xl overflow-hidden">
            <div className="bg-yellow-600/10 p-3 flex justify-between items-center border-b border-yellow-600/20">
              <span className="text-yellow-500 font-bold text-sm">TIER B (Compatível)</span>
              <span className="text-[10px] text-yellow-500/80 bg-yellow-900/30 px-2 py-0.5 rounded">Sem Acesso Nativo</span>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 bg-[#252525] p-2 rounded-lg border border-[#333]">
                <Flame size={20} className="text-orange-500" /> <span className="text-sm text-white">Firefox</span>
              </div>
              <div className="flex items-center gap-3 bg-[#252525] p-2 rounded-lg border border-[#333]">
                <Compass size={20} className="text-blue-300" /> <span className="text-sm text-white">Safari</span>
              </div>
            </div>
            <div className="px-4 pb-3">
              <p className="text-[10px] text-gray-500 mt-2 flex items-center gap-1">
                <AlertTriangle size={10} className="text-yellow-500"/> Arquivos locais requerem "Salvar como Cópia".
              </p>
            </div>
          </div>

        </div>
      </div>
    )
  },
  {
    id: 'tuning',
    title: 'Tuning & Performance',
    icon: Zap,
    content: (
      <div className="space-y-6">
        
        {/* DISCLAIMER */}
        <div className="bg-red-900/10 border border-red-500/30 p-4 rounded-xl flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
            <div>
                <h4 className="text-sm font-bold text-red-400 mb-1 uppercase tracking-wider">Aviso de Risco</h4>
                <p className="text-xs text-red-200/80 leading-relaxed text-justify">
                    As configurações abaixo alteram o motor de renderização do navegador. 
                    Embora testadas, elas podem causar instabilidade. 
                    <strong>O usuário assume total responsabilidade ao modificar flags experimentais.</strong>
                </p>
            </div>
        </div>

        {/* CHROMIUM SECTION (CHROME & VIVALDI) */}
        <div className="bg-[#1a1a1a] border border-blue-500/30 rounded-xl overflow-hidden">
            <div className="bg-blue-500/10 p-3 flex items-center gap-2 border-b border-blue-500/20">
                <div className="flex -space-x-1">
                    <Chrome size={18} className="text-blue-400" />
                    <Layers size={18} className="text-red-400" />
                </div>
                <span className="text-white font-bold text-sm">Protocolo Chromium (Chrome & Vivaldi)</span>
            </div>
            
            <div className="p-5 space-y-4">
                <p className="text-xs text-gray-300 leading-relaxed">
                    Estas configurações forçam o uso da GPU para renderizar os PDFs e a interface, liberando a CPU para a Inteligência Artificial.
                </p>

                <div className="space-y-2">
                    <div className="bg-black/40 p-2 rounded border border-gray-700 flex justify-between items-center">
                        <span className="text-xs text-gray-400 font-mono">Chrome</span>
                        <code className="text-xs text-blue-400 font-bold bg-blue-900/20 px-2 py-0.5 rounded">chrome://flags</code>
                    </div>
                    <div className="bg-black/40 p-2 rounded border border-gray-700 flex justify-between items-center">
                        <span className="text-xs text-gray-400 font-mono">Vivaldi</span>
                        <code className="text-xs text-red-400 font-bold bg-red-900/20 px-2 py-0.5 rounded">vivaldi://flags</code>
                    </div>
                    
                    <div className="bg-[#252525] rounded-lg border border-[#333] overflow-hidden">
                        <table className="w-full text-left text-[10px]">
                            <thead className="bg-black/20 text-gray-500 uppercase font-bold">
                                <tr>
                                    <th className="p-2 border-r border-[#333]">Pesquisar Flag (#)</th>
                                    <th className="p-2 border-r border-[#333] w-16">Mudar para</th>
                                    <th className="p-2">Motivo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#333] text-gray-300">
                                <tr>
                                    <td className="p-2 font-mono text-blue-300 border-r border-[#333]">gpu-rasterization</td>
                                    <td className="p-2 text-green-400 font-bold border-r border-[#333]">Enabled</td>
                                    <td className="p-2">Desenha o PDF usando a placa de vídeo.</td>
                                </tr>
                                <tr>
                                    <td className="p-2 font-mono text-blue-300 border-r border-[#333]">enable-zero-copy</td>
                                    <td className="p-2 text-green-400 font-bold border-r border-[#333]">Enabled</td>
                                    <td className="p-2">Escreve direto na memória GPU (Menos RAM).</td>
                                </tr>
                                <tr>
                                    <td className="p-2 font-mono text-blue-300 border-r border-[#333]">enable-parallel-downloading</td>
                                    <td className="p-2 text-green-400 font-bold border-r border-[#333]">Enabled</td>
                                    <td className="p-2">Acelera download de PDFs grandes.</td>
                                </tr>
                                <tr>
                                    <td className="p-2 font-mono text-blue-300 border-r border-[#333]">smooth-scrolling</td>
                                    <td className="p-2 text-yellow-400 font-bold border-r border-[#333]">Disabled</td>
                                    <td className="p-2">Opcional. Remove o "efeito elástico" para resposta tátil instantânea.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        {/* FIREFOX SECTION */}
        <div className="bg-[#1a1a1a] border border-orange-500/30 rounded-xl overflow-hidden">
            <div className="bg-orange-500/10 p-3 flex items-center gap-2 border-b border-orange-500/20">
                <Flame size={18} className="text-orange-500" />
                <span className="text-white font-bold text-sm">Protocolo Firefox (Android)</span>
            </div>
            
            <div className="p-5 space-y-4">
                <p className="text-xs text-gray-300 leading-relaxed">
                    O Firefox padrão bloqueia configurações avançadas. Para habilitar 60fps no PDF e OCR rápido, 
                    recomenda-se o uso do <strong>Firefox Nightly</strong>.
                </p>

                <div className="space-y-2">
                    <div className="bg-black/40 p-2 rounded border border-gray-700 flex justify-between items-center">
                        <span className="text-xs text-gray-400 font-mono">Endereço de Config</span>
                        <code className="text-xs text-green-400 font-bold bg-green-900/20 px-2 py-0.5 rounded">about:config</code>
                    </div>
                    
                    <div className="bg-[#252525] rounded-lg border border-[#333] overflow-hidden">
                        <table className="w-full text-left text-[10px]">
                            <thead className="bg-black/20 text-gray-500 uppercase font-bold">
                                <tr>
                                    <th className="p-2 border-r border-[#333]">Flag (Pesquisar)</th>
                                    <th className="p-2 border-r border-[#333] w-16">Valor</th>
                                    <th className="p-2">Efeito</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#333] text-gray-300">
                                <tr>
                                    <td className="p-2 font-mono text-orange-300 border-r border-[#333]">gfx.webrender.all</td>
                                    <td className="p-2 text-green-400 font-bold border-r border-[#333]">true</td>
                                    <td className="p-2">Aceleração GPU total (Fluidez)</td>
                                </tr>
                                <tr>
                                    <td className="p-2 font-mono text-orange-300 border-r border-[#333]">layers.acceleration.force-enabled</td>
                                    <td className="p-2 text-green-400 font-bold border-r border-[#333]">true</td>
                                    <td className="p-2">Evita lag em PDFs grandes</td>
                                </tr>
                                <tr>
                                    <td className="p-2 font-mono text-orange-300 border-r border-[#333]">javascript.options.wasm_simd</td>
                                    <td className="p-2 text-green-400 font-bold border-r border-[#333]">true</td>
                                    <td className="p-2">Acelera o motor de IA/OCR</td>
                                </tr>
                                <tr>
                                    <td className="p-2 font-mono text-orange-300 border-r border-[#333]">javascript.options.shared_memory</td>
                                    <td className="p-2 text-green-400 font-bold border-r border-[#333]">true</td>
                                    <td className="p-2">Multithreading eficiente</td>
                                </tr>
                                <tr>
                                    <td className="p-2 font-mono text-orange-300 border-r border-[#333]">apz.allow_zooming</td>
                                    <td className="p-2 text-red-400 font-bold border-r border-[#333]">false</td>
                                    <td className="p-2">Impede conflito de zoom duplo</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex gap-2">
                    <div className="flex-1 bg-[#252525] p-3 rounded-lg border border-[#333]">
                        <div className="flex items-center gap-2 mb-1 text-purple-400 text-xs font-bold">
                            <Layers size={14} /> Extensões
                        </div>
                        <p className="text-[10px] text-gray-400">
                            Use <strong>uBlock Origin</strong> para limpar scripts de fundo.
                            <br/>
                            <span className="text-red-400">NÃO USE Dark Reader</span> (causa lag severo).
                        </p>
                    </div>
                    <div className="flex-1 bg-[#252525] p-3 rounded-lg border border-[#333]">
                        <div className="flex items-center gap-2 mb-1 text-green-400 text-xs font-bold">
                            <Battery size={14} /> Android
                        </div>
                        <p className="text-[10px] text-gray-400">
                            Configure a bateria do App para <strong>"Não Restrito"</strong>.
                            Vital para o OCR não morrer em segundo plano.
                        </p>
                    </div>
                </div>
            </div>
        </div>

      </div>
    )
  },
  {
    id: 'troubleshoot',
    title: 'Solução de Problemas',
    icon: Wrench,
    content: (
      <div className="space-y-6">
        <h3 className="text-lg font-bold text-white mb-4">Diagnóstico e Correção Rápida</h3>
        
        <div className="space-y-4">
          
          {/* ERRO 1: Auth */}
          <div className="bg-[#2c2c2c] p-4 rounded-xl border border-gray-700">
            <div className="flex items-center gap-2 text-yellow-500 font-bold text-sm mb-2">
              <AlertCircle size={16} /> Erro "Não foi possível salvar" ou "403 Forbidden"
            </div>
            <p className="text-xs text-gray-300 mb-3">
              Isso acontece quando o Lectorium perde a permissão de escrever no seu Google Drive. Geralmente ocorre se a sessão expirou ou se você desmarcou as caixas de permissão no login.
            </p>
            <div className="bg-black/30 p-2 rounded border border-gray-600 text-xs text-green-400 font-mono flex items-center gap-2">
              <RefreshCw size={12} /> Solução: Faça Logout e Login novamente, marcando TODAS as caixas do Google.
            </div>
          </div>

          {/* ERRO 2: Local Files */}
          <div className="bg-[#2c2c2c] p-4 rounded-xl border border-gray-700">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-sm mb-2">
              <FileText size={16} /> Arquivos Locais não salvam no Drive
            </div>
            <p className="text-xs text-gray-300 mb-3">
              Por segurança, o navegador isola arquivos abertos do disco ("Abrir Local"). Eles vivem apenas na memória temporária da aba.
            </p>
            <div className="bg-black/30 p-2 rounded border border-gray-600 text-xs text-white">
              <strong>Solução:</strong> Use a opção "Salvar como Cópia" ou "Salvar no Drive" dentro do menu do editor para fazer o upload definitivo.
            </div>
          </div>

          {/* ERRO 3: AI Quota */}
          <div className="bg-[#2c2c2c] p-4 rounded-xl border border-gray-700">
            <div className="flex items-center gap-2 text-purple-400 font-bold text-sm mb-2">
              <Workflow size={16} /> A IA parou de responder (Erro 429)
            </div>
            <p className="text-xs text-gray-300 mb-3">
              O modelo Gemini possui limites de requisições por minuto na camada gratuita. Se você processou muitas páginas rapidamente, o Google bloqueia temporariamente.
            </p>
            <div className="bg-black/30 p-2 rounded border border-gray-600 text-xs text-white">
              <strong>Solução:</strong> Aguarde 1 ou 2 minutos e tente novamente. Para uso pesado, adicione sua própria API Key nas configurações.
            </div>
          </div>

          {/* ERRO 4: Cache */}
          <div className="bg-[#2c2c2c] p-4 rounded-xl border border-gray-700">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm mb-2">
              <AlertTriangle size={16} /> Interface travada ou branca
            </div>
            <p className="text-xs text-gray-300 mb-3">
              Atualizações do aplicativo podem conflitar com dados antigos no cache do navegador.
            </p>
            <div className="bg-black/30 p-2 rounded border border-gray-600 text-xs text-white">
              <strong>Solução:</strong> Vá em Configurações (Menu Lateral) {'>'} Armazenamento {'>'} Redefinir Aplicação.
            </div>
          </div>

        </div>
      </div>
    )
  },
  {
    id: 'pdf',
    title: 'Dominando o PDF',
    icon: FileText,
    content: (
      <div className="space-y-6">
        <h3 className="text-lg font-bold text-white">Ferramentas de Leitura</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#2c2c2c] p-4 rounded-xl border border-gray-700">
            <div className="flex items-center gap-2 text-brand mb-2">
              <Highlighter size={18} /> <strong>Marca-texto</strong>
            </div>
            <p className="text-xs text-gray-400">
              Selecione o texto e clique no botão de destaque.
            </p>
          </div>
          <div className="bg-[#2c2c2c] p-4 rounded-xl border border-gray-700">
            <div className="flex items-center gap-2 text-purple-400 mb-2">
              <Pen size={18} /> <strong>Caneta</strong>
            </div>
            <p className="text-xs text-gray-400">
              Use a barra de ferramentas inferior para desenhar livremente sobre o PDF.
            </p>
          </div>
        </div>

        <div className="bg-brand/5 border border-brand/20 p-5 rounded-2xl">
          <h4 className="text-brand font-bold flex items-center gap-2 mb-3">
            <Touchpad size={18} /> Smart Tap (Seleção Rápida)
          </h4>
          <p className="text-sm text-gray-300 mb-4">
            Selecionar texto em PDFs no celular ou trackpad pode ser difícil. O Lectorium resolve isso com o <strong>toque em dois pontos</strong>:
          </p>
          
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-brand text-black flex items-center justify-center font-bold text-xs">1</span>
              <p className="text-xs text-gray-300">Toque na <strong>primeira palavra</strong> que deseja selecionar.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-brand text-black flex items-center justify-center font-bold text-xs">2</span>
              <p className="text-xs text-gray-300">Toque na <strong>última palavra</strong>.</p>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <CheckCircle2 size={16} className="text-green-500 ml-1" />
              <p className="text-xs text-white font-bold">Pronto! O sistema preenche tudo no meio.</p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'ai',
    title: 'Kalaki (IA)',
    icon: Workflow,
    content: (
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white">Sua Assistente de Pesquisa</h3>
        <p className="text-sm text-gray-300">
          A "Kalaki" é a inteligência artificial integrada. Ela lê o que você está vendo.
        </p>

        <div className="space-y-3">
          <div className="bg-[#2c2c2c] p-3 rounded-xl border border-gray-700 flex items-center gap-3">
            <div className="bg-purple-500/20 p-2 rounded-lg text-purple-400"><MousePointerClick size={18} /></div>
            <div className="text-xs text-gray-300">
              <strong>Selecione e Pergunte:</strong> Ao selecionar um texto, clique no botão "IA" para pedir uma explicação específica daquele trecho.
            </div>
          </div>

          <div className="bg-[#2c2c2c] p-3 rounded-xl border border-gray-700 flex items-center gap-3">
            <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400"><FileText size={18} /></div>
            <div className="text-xs text-gray-300">
              <strong>Resumo do Documento:</strong> Abra a barra lateral da IA e peça um resumo geral ou faça perguntas sobre o arquivo todo.
            </div>
          </div>
        </div>
        
        <p className="text-[10px] text-gray-500 italic mt-2">
          Nota: A IA usa o modelo Gemini do Google. Respostas podem variar.
        </p>
      </div>
    )
  },
  {
    id: 'offline',
    title: 'Modo Offline',
    icon: WifiOff,
    content: (
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white">Sem Internet? Sem Problema.</h3>
        <p className="text-sm text-gray-300">
          O Lectorium salva automaticamente os arquivos que você abre no seu dispositivo.
        </p>
        <ul className="list-disc list-inside text-xs text-gray-400 space-y-2 ml-2">
          <li>Você pode fechar a aba e abrir de novo sem internet.</li>
          <li>Suas edições offline são salvas localmente.</li>
          <li>Assim que a internet voltar, tudo é enviado para o Google Drive.</li>
        </ul>
        <div className="bg-green-500/10 border border-green-500/30 p-3 rounded-xl text-xs text-green-300">
          <strong>Dica:</strong> Instale o app (Adicionar à Tela de Início) para a melhor experiência offline.
        </div>
      </div>
    )
  },
  {
    id: 'privacy',
    title: 'Privacidade',
    icon: ShieldCheck,
    content: (
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white">Seus Dados são Seus</h3>
        <p className="text-sm text-gray-300">
          Diferente de outros sites, nós <strong>não copiamos seus arquivos</strong> para nossos servidores.
        </p>
        <p className="text-sm text-gray-300">
          O Lectorium funciona como um óculos: ele apenas visualiza e edita o que já está no seu Google Drive ou no seu computador.
        </p>
        <p className="text-xs text-gray-500 mt-4">
          Nós não vemos seus PDFs, não lemos seus mapas mentais e não vendemos suas informações.
        </p>
      </div>
    )
  }
];

export const GlobalHelpModal: React.FC<Props> = ({ isOpen, onClose, isMandatory = false }) => {
  const [activeSection, setActiveSection] = useState('intro');
  const [showMobileContent, setShowMobileContent] = useState(false);

  useEffect(() => {
    if (isOpen) setShowMobileContent(false);
  }, [isOpen]);

  const handleSectionClick = (id: string) => {
    setActiveSection(id);
    setShowMobileContent(true);
  };

  if (!isOpen) return null;

  const currentContent = SECTIONS.find(s => s.id === activeSection)?.content;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#1e1e1e] text-[#e3e3e3] rounded-3xl shadow-2xl w-full max-w-4xl h-[80vh] flex overflow-hidden border border-[#444746] animate-in zoom-in-95">
        
        {/* Sidebar Navigation */}
        <div className={`w-full md:w-64 bg-[#141414] border-r border-[#333] flex-col ${showMobileContent ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-6 border-b border-[#333]">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <BookOpen className="text-brand" size={20}/>
              Guia Central
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => handleSectionClick(section.id)}
                className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all ${
                  activeSection === section.id 
                    ? 'bg-brand text-[#0b141a] font-bold shadow-lg shadow-brand/20 scale-[1.02]' 
                    : 'text-gray-400 hover:bg-[#2c2c2c] hover:text-white'
                }`}
              >
                <section.icon size={18} />
                <span className="text-sm">{section.title}</span>
                <ArrowRight size={14} className="ml-auto md:hidden opacity-50" />
              </button>
            ))}
          </div>

          {!isMandatory && (
            <div className="p-4 border-t border-[#333]">
                <button onClick={onClose} className="w-full py-2 bg-[#2c2c2c] hover:bg-[#3c3c3c] rounded-lg text-sm font-medium transition-colors">
                Fechar Guia
                </button>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className={`flex-1 flex-col relative bg-[#1e1e1e] ${!showMobileContent ? 'hidden md:flex' : 'flex'}`}>
          {/* Mobile Back Button */}
          <div className="md:hidden flex items-center p-4 border-b border-[#333] bg-[#141414]">
             <button onClick={() => setShowMobileContent(false)} className="flex items-center gap-2 text-gray-300 font-bold text-sm">
                 <ArrowLeft size={18} /> Voltar
             </button>
          </div>

          {!isMandatory && (
            <button 
                onClick={onClose} 
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full hidden md:block"
            >
                <X size={24} />
            </button>
          )}

          <div className="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar">
            <div className="max-w-2xl mx-auto animate-in slide-in-from-right-4 duration-300 key={activeSection}">
              {currentContent}
            </div>
          </div>

          {isMandatory && (
            <div className="p-6 border-t border-[#333] flex justify-end bg-[#1e1e1e]">
                <button 
                    onClick={onClose} 
                    className="bg-brand text-[#0b141a] px-8 py-3 rounded-xl font-bold hover:brightness-110 transition-all flex items-center gap-2 shadow-lg"
                >
                    Entendi, ir para o Workspace <ArrowRight size={18} />
                </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

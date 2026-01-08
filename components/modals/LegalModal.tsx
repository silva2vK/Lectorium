
import React, { useState, useEffect, useRef } from 'react';
import { Scale, Shield, FileText, AlertTriangle, Gavel, CheckCircle } from 'lucide-react';
import { BaseModal } from '../shared/BaseModal';

export type LegalTab = 'terms' | 'privacy';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: LegalTab;
  isMandatory?: boolean;
}

const LegalSection = ({ title, children }: { title: string, children?: React.ReactNode }) => (
  <div className="mb-8 border-b border-white/5 pb-6 last:border-0 text-justify">
    <h4 className="text-white font-bold text-sm mb-3 uppercase tracking-wider flex items-center gap-2 border-l-2 border-brand pl-3">
      {title}
    </h4>
    <div className="text-[#a1a1aa] text-[11px] leading-[1.8] space-y-4 font-serif">
      {children}
    </div>
  </div>
);

export const LegalModal: React.FC<Props> = ({ isOpen, onClose, initialTab = 'privacy', isMandatory = false }) => {
  const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);
  const contentRef = useRef<HTMLDivElement>(null);
  const [hasReadBottom, setHasReadBottom] = useState(!isMandatory);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      if (contentRef.current) contentRef.current.scrollTop = 0;
    }
  }, [isOpen, initialTab]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!isMandatory) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      setHasReadBottom(true);
    }
  };

  const PrivacyContent = () => (
    <div className="space-y-4">
      <div className="bg-blue-900/10 border border-blue-500/20 p-5 rounded-lg mb-8">
        <h4 className="text-blue-400 font-bold flex items-center gap-2 mb-3 text-xs uppercase tracking-widest">
          <Shield size={14} /> Arquitetura de Soberania de Dados (Zero-Knowledge)
        </h4>
        <p className="text-[10px] text-blue-200/70 text-justify leading-relaxed font-mono">
          ATENÇÃO: O Lectorium difere fundamentalmente de serviços SaaS tradicionais. 
          Operamos sob uma arquitetura "Local-First" estrita. Não possuímos, não operamos e não temos acesso técnico a servidores de banco de dados 
          capazes de armazenar seus arquivos, anotações ou chaves de criptografia. Toda a persistência de dados ocorre: (A) Na memória física do seu dispositivo; 
          ou (B) Nos servidores da Google LLC (Google Drive), sob custódia exclusiva de suas credenciais pessoais.
        </p>
      </div>

      <LegalSection title="ARTIGO 1º - COLETA, TRATAMENTO E MINIMIZAÇÃO DE DADOS">
        <p>
          <strong>1.1. Natureza Descentralizada do Tratamento.</strong> O Usuário reconhece e concorda que o Lectorium atua meramente como um agente de interface ("User-Agent" ou "Client-Side Application") que é executado localmente no navegador do Usuário. Em virtude desta arquitetura técnica, a Desenvolvedora não realiza a coleta, o armazenamento, a indexação, a mineração ou a venda de "Conteúdo de Usuário" (definido como arquivos PDF, documentos DOCX, mapas mentais, anotações manuscritas, destaques e metadados associados).
        </p>
        <p>
          <strong>1.2. Identificação e Autenticação (Federated Identity).</strong> O Serviço utiliza a infraestrutura do Google Firebase Authentication estritamente para fins de gerenciamento de sessão e emissão de tokens de segurança (OAuth 2.0). Os únicos dados pessoais processados transitoriamente pela aplicação são: (i) Identificador Numérico Único (UID); (ii) Endereço de e-mail; e (iii) Nome de exibição público. Tais dados são utilizados exclusivamente para autenticar as requisições feitas pelo navegador do Usuário diretamente às APIs do Google Drive. Não mantemos cadastros paralelos ou perfis de usuário ("Shadow Profiles").
        </p>
        <p>
          <strong>1.3. Persistência Local (IndexedDB e OPFS).</strong> Para garantir o funcionamento offline e a performance da aplicação, dados técnicos, caches de renderização, vetores semânticos e cópias temporárias de arquivos são armazenados no dispositivo do Usuário utilizando as tecnologias IndexedDB e Origin Private File System (OPFS). O Usuário detém o controle físico absoluto sobre estes dados, podendo eliminá-los unilateralmente através das ferramentas de limpeza de cache do navegador ("Clear Browsing Data"). A Desenvolvedora não possui meios técnicos para acessar, extrair ou recuperar estes dados remotamente.
        </p>
      </LegalSection>

      <LegalSection title="ARTIGO 2º - INTEGRAÇÃO COM PROCESSADORES DE TERCEIROS">
        <p>
          <strong>2.1. Google Drive API (Armazenamento em Nuvem).</strong> O Lectorium interage diretamente com a API do Google Drive para listar, baixar e atualizar arquivos. O token de acesso (Access Token) concedido pelo Usuário é armazenado de forma criptografada na memória local (localStorage) e é transmitido apenas para os servidores da Google LLC via protocolo HTTPS (TLS 1.3). Em nenhuma hipótese esse token é enviado, espelhado ou armazenado em servidores intermediários sob controle da Desenvolvedora. A segurança, integridade, disponibilidade e confidencialidade dos arquivos armazenados na nuvem são regidas exclusivamente pelos Termos de Serviço e Políticas de Privacidade da Google LLC.
        </p>
        <p>
          <strong>2.2. Inteligência Artificial Generativa (Google Gemini/Vertex AI).</strong> Ao utilizar funcionalidades de IA (como "Sexta-feira", "Lente Semântica", resumos ou chats), o conteúdo textual selecionado ou extraído do documento é enviado diretamente do navegador do Usuário para a API da Google (Vertex AI ou Gemini API).
          <br/><br/>
          (a) <strong>Transitoriedade:</strong> Não mantemos logs, histórico ou cópia das interações ("Prompts" e "Completions") em nossa infraestrutura.
          <br/>
          (b) <strong>Chave de API Pessoal (BYOK):</strong> Caso o Usuário opte por utilizar sua própria chave de API ("Bring Your Own Key"), aplicam-se os termos da Google para desenvolvedores, nos quais a Google declara contratualmente não utilizar dados provenientes de APIs pagas para o treinamento de seus modelos fundacionais.
        </p>
      </LegalSection>

      <LegalSection title="ARTIGO 3º - COOKIES, RASTREAMENTO E TELEMETRIA">
        <p>
          <strong>3.1. Ausência de Rastreamento Publicitário.</strong> O Serviço não utiliza cookies de terceiros, pixels de rastreamento, "fingerprinting" ou quaisquer tecnologias similares para fins de publicidade comportamental, criação de perfil de consumo ou revenda de dados a "Data Brokers".
        </p>
        <p>
          <strong>3.2. Armazenamento Técnico Essencial.</strong> Utilizamos o armazenamento local (Cookies/LocalStorage) estritamente para fins técnicos essenciais, tais como: (i) Persistência de preferências de interface (ex: Tema Escuro/Claro); (ii) Manutenção do estado de autenticação; e (iii) Configurações de ferramentas de edição.
        </p>
        <p>
          <strong>3.3. Telemetria de Diagnóstico.</strong> Reservamo-nos o direito de coletar dados anônimos de travamento ("Crash Reports") e métricas de desempenho técnico (ex: tempo de carregamento de módulos, erros de API) estritamente para fins de manutenção corretiva e estabilidade do software. Estes relatórios são desprovidos de qualquer Conteúdo de Usuário ou Informação Pessoal Identificável (PII).
        </p>
      </LegalSection>

      <LegalSection title="ARTIGO 4º - DIREITOS DO TITULAR (LGPD)">
        <p>
          <strong>4.1. Exercício de Direitos.</strong> Conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), o Usuário tem direito a: (i) Confirmação da existência de tratamento; (ii) Acesso aos dados; (iii) Correção de dados incompletos ou desatualizados; e (iv) Revogação do consentimento.
        </p>
        <p>
          <strong>4.2. Mecanismos de Exclusão.</strong> Como o Lectorium não armazena seus arquivos em servidores proprietários, a "exclusão de dados" é realizada pelo próprio Usuário ao: (a) Desconectar sua conta Google nas configurações; (b) Limpar o cache do navegador; e (c) Revogar o acesso do aplicativo nas configurações de segurança da Conta Google.
        </p>
      </LegalSection>
    </div>
  );

  const TermsContent = () => (
    <div className="space-y-4">
      <div className="bg-red-900/10 border border-red-500/20 p-5 rounded-lg mb-8">
        <h4 className="text-red-400 font-bold flex items-center gap-2 mb-3 text-xs uppercase tracking-widest">
          <AlertTriangle size={14} /> CLÁUSULA DE ISENÇÃO TOTAL DE GARANTIAS ("AS IS")
        </h4>
        <p className="text-[10px] text-red-200/70 text-justify leading-relaxed font-mono">
          O SOFTWARE É LICENCIADO E FORNECIDO "NO ESTADO EM QUE SE ENCONTRA" ("AS IS"), SEM QUAISQUER GARANTIAS, EXPRESSAS OU IMPLÍCITAS, INCLUINDO, MAS NÃO SE LIMITANDO A, GARANTIAS DE COMERCIABILIDADE, ADEQUAÇÃO A UMA FINALIDADE ESPECÍFICA, INTEGRIDADE DE DADOS OU NÃO VIOLAÇÃO. O USO DO SERVIÇO É DE INTEIRO RISCO DO USUÁRIO. O DESENVOLVEDOR NÃO GARANTE QUE O SOFTWARE ESTARÁ LIVRE DE ERROS, VÍRUS OU INTERRUPÇÕES.
        </p>
      </div>

      <LegalSection title="ARTIGO 1º - OBJETO E LICENÇA DE USO">
        <p>
          <strong>1.1. Concessão de Licença Limitada.</strong> Sujeito ao cumprimento integral destes Termos, concedemos ao Usuário uma licença pessoal, mundial, revogável, não exclusiva, intransferível e não sublicenciável para acessar e utilizar o Lectorium estritamente para fins acadêmicos, de pesquisa e produtividade pessoal, através de um navegador web compatível.
        </p>
        <p>
          <strong>1.2. Restrições de Uso.</strong> É estritamente vedado ao Usuário: (i) Realizar engenharia reversa, descompilação ou desmontagem do código-fonte do Software; (ii) Utilizar o Serviço para processar dados ilegais, difamatórios ou que violem direitos de propriedade intelectual de terceiros; (iii) Tentar contornar quaisquer medidas de segurança ou autenticação do Serviço ou das APIs do Google; (iv) Utilizar o Serviço de maneira automatizada ("botting") que sobrecarregue injustificadamente a infraestrutura de terceiros.
        </p>
      </LegalSection>

      <LegalSection title="ARTIGO 2º - DADOS LOCAIS E RISCO DE PERDA">
        <p>
          <strong>2.1. Volatilidade e Ausência de Backup Proprietário.</strong> O Lectorium é uma aplicação "Local-First". O Usuário reconhece expressamente que dados não sincronizados com o Google Drive (como arquivos em "Modo Offline" ou alterações pendentes na fila de sincronização) residem em áreas voláteis do dispositivo. A limpeza de cache do navegador, falhas de hardware, reinstalação do sistema operacional ou ações de softwares de limpeza ("Cleaners") podem resultar na <strong>PERDA IRREVERSÍVEL E PERMANENTE</strong> de dados. A Desenvolvedora não possui cópias de segurança (backups) e não pode recuperar dados perdidos localmente.
        </p>
      </LegalSection>

      <LegalSection title="ARTIGO 3º - INTELIGÊNCIA ARTIFICIAL E ALUCINAÇÕES">
        <p>
          <strong>3.1. Natureza Probabilística (LLMs).</strong> As funcionalidades de IA são baseadas em Grandes Modelos de Linguagem (LLMs), que operam sob princípios probabilísticos e não determinísticos. O Lectorium <strong>NÃO GARANTE</strong> a precisão, veracidade, completude ou atualidade das informações, resumos ou respostas geradas pela IA.
        </p>
        <p>
          <strong>3.2. Vedação de Uso Crítico sem Supervisão.</strong> É estritamente proibido utilizar as saídas da IA ("Outputs") para tomada de decisões críticas, incluindo, mas não se limitando a: diagnósticos médicos, aconselhamento jurídico, consultoria financeira ou operações de segurança, sem a devida e rigorosa verificação humana.
        </p>
        <p>
          <strong>3.3. Integridade Acadêmica.</strong> O Usuário assume total e exclusiva responsabilidade ética e legal pelo uso das saídas da IA em trabalhos acadêmicos, teses, dissertações ou publicações científicas. O Lectorium exime-se de qualquer responsabilidade solidária em casos de plágio, fabricação de dados ou violação de códigos de ética acadêmica decorrentes do uso da ferramenta.
        </p>
      </LegalSection>

      <LegalSection title="ARTIGO 4º - LIMITAÇÃO DE RESPONSABILIDADE E INDENIZAÇÃO">
        <p>
          <strong>4.1. Limitação de Danos (Cap).</strong> <strong>Respeitados os limites intransponíveis da legislação consumerista aplicável (incluindo o Código de Defesa do Consumidor no Brasil)</strong>, EM NENHUMA HIPÓTESE A DESENVOLVEDORA, SEUS AFILIADOS, DIRETORES OU FORNECEDORES SERÃO RESPONSÁVEIS POR QUAISQUER DANOS INDIRETOS, INCIDENTAIS, ESPECIAIS, CONSEQUENCIAIS OU PUNITIVOS (INCLUINDO PERDA DE LUCROS, DADOS, USO OU FUNDO DE COMÉRCIO) DECORRENTES DE: (I) ACESSO, USO OU INCAPACIDADE DE ACESSAR O SERVIÇO; (II) CONDUTA DE TERCEIROS; (III) ACESSO NÃO AUTORIZADO A DADOS DO USUÁRIO NOS SERVIDORES DA GOOGLE. A RESPONSABILIDADE TOTAL DA DESENVOLVEDORA POR QUAISQUER REIVINDICAÇÕES RELACIONADAS AO SERVIÇO ESTÁ LIMITADA AO MONTANTE PAGO PELO USUÁRIO (SE HOUVER) NOS ÚLTIMOS 12 MESES.
        </p>
        <p>
          <strong>4.2. Indenização.</strong> O Usuário concorda em defender, indenizar e isentar a Desenvolvedora de e contra quaisquer reivindicações, danos, obrigações, perdas, responsabilidades, custos ou dívidas e despesas (incluindo honorários advocatícios) decorrentes de: (i) Violação destes Termos pelo Usuário; (ii) Violação de quaisquer direitos de terceiros pelo Conteúdo de Usuário processado no Serviço.
        </p>
      </LegalSection>

      <LegalSection title="ARTIGO 5º - DESCONTINUAÇÃO E ENCERRAMENTO">
        <p>
          <strong>5.1. Aviso Prévio.</strong> A Desenvolvedora reserva-se o direito de descontinuar o Serviço a qualquer momento. Em caso de encerramento definitivo das operações, os usuários serão notificados com antecedência razoável (mínimo de 30 dias) via interface da aplicação ou e-mail, para que possam sincronizar quaisquer dados locais pendentes com o Google Drive.
        </p>
      </LegalSection>

      <LegalSection title="ARTIGO 6º - DIREITO DE ARREPENDIMENTO (BRASIL)">
        <p>
          <strong>6.1. Prazo de 7 Dias.</strong> Caso o Serviço venha a oferecer funcionalidades pagas, o Usuário residente no Brasil poderá exercer seu direito de arrependimento no prazo de 7 (sete) dias corridos a contar da contratação, conforme Art. 49 do CDC, mediante solicitação formal pelos canais de suporte.
        </p>
      </LegalSection>

      <LegalSection title="ARTIGO 7º - DISPOSIÇÕES GERAIS">
        <p>
          <strong>7.1. Modificações.</strong> Reservamo-nos o direito de modificar estes Termos a qualquer momento. O uso continuado do Serviço após tais alterações constitui aceitação dos novos Termos.
        </p>
        <p>
          <strong>7.2. Lei Aplicável e Foro.</strong> Estes Termos serão regidos e interpretados de acordo com as leis da República Federativa do Brasil, sem levar em conta seus conflitos de disposições legais. Fica eleito o Foro da Comarca da Capital do Estado de São Paulo para dirimir quaisquer litígios oriundos deste instrumento, com renúncia expressa a qualquer outro, por mais privilegiado que seja.
        </p>
      </LegalSection>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div 
        className="bg-[#0f0f0f] border border-[#333] rounded-2xl w-full max-w-3xl relative flex flex-col max-h-[85vh] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-[#333] bg-[#141414] rounded-t-2xl shrink-0">
          <div className="flex items-center gap-3">
            <Scale className="text-brand" size={24} />
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">Termos Jurídicos</h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Instrumento Vinculante</p>
            </div>
          </div>
          {!isMandatory && (
            <button 
              onClick={onClose} 
              className="p-2 text-gray-500 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <FileText size={20} />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#333] bg-[#141414] shrink-0">
           <button 
             onClick={() => setActiveTab('privacy')}
             className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-all relative ${activeTab === 'privacy' ? 'text-brand bg-brand/5' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
           >
              <span className="flex items-center justify-center gap-2"><Shield size={14} /> Política de Privacidade</span>
              {activeTab === 'privacy' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand shadow-[0_0_10px_var(--brand)]"></div>}
           </button>
           <button 
             onClick={() => setActiveTab('terms')}
             className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-all relative ${activeTab === 'terms' ? 'text-brand bg-brand/5' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
           >
              <span className="flex items-center justify-center gap-2"><Gavel size={14} /> Termos de Serviço</span>
              {activeTab === 'terms' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand shadow-[0_0_10px_var(--brand)]"></div>}
           </button>
        </div>

        {/* Content Scrollable */}
        <div 
            ref={contentRef}
            className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[#0f0f0f]"
            onScroll={handleScroll}
        >
          {activeTab === 'privacy' ? <PrivacyContent /> : <TermsContent />}
          
          <div className="mt-12 pt-8 border-t border-[#333] text-center">
             <p className="text-[9px] text-gray-600 font-serif italic max-w-lg mx-auto">
               Última atualização jurídica: Fevereiro de 2025. O uso continuado do software constitui aceitação irrevogável destes termos. A nulidade de qualquer cláusula não afeta a validade das demais.
             </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-[#333] bg-[#141414] rounded-b-2xl shrink-0 flex flex-col items-center gap-3">
          {isMandatory ? (
            <>
              {!hasReadBottom && (
                <div className="text-xs text-yellow-500 flex items-center gap-2 animate-pulse mb-2 font-mono">
                   <AlertTriangle size={12} /> Leia o documento até o final para habilitar o aceite.
                </div>
              )}
              <button 
                onClick={onClose} 
                disabled={!hasReadBottom}
                className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-3 transition-all uppercase tracking-wider ${
                    hasReadBottom 
                    ? 'bg-brand text-[#0b141a] hover:brightness-110 shadow-[0_0_20px_rgba(74,222,128,0.2)] cursor-pointer transform hover:scale-[1.01]' 
                    : 'bg-[#222] text-gray-600 cursor-not-allowed border border-[#333]'
                }`}
              >
                <CheckCircle size={18} />
                Li, Compreendi e Concordo Plenamente
              </button>
              <p className="text-[9px] text-gray-600 font-mono">
                Ao clicar, você concorda com estes termos. Para usuários no Brasil, a cláusula de arbitragem aplica-se respeitando os limites do Código de Defesa do Consumidor.
              </p>
            </>
          ) : (
            <button onClick={onClose} className="w-full bg-[#222] hover:bg-[#333] text-white py-3 rounded-xl transition-colors font-medium border border-[#333] text-xs uppercase tracking-wider">
              Fechar Documento
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

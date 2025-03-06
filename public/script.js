document.addEventListener('DOMContentLoaded', function() {
    // Elementos do DOM
    const youtubeUrlInput = document.getElementById('youtube-url');
    const pasteButton = document.getElementById('paste-button');
    const mp3Button = document.getElementById('mp3-button');
    const mp4Button = document.getElementById('mp4-button');
    const convertButton = document.getElementById('convert-button');
    const resultContainer = document.getElementById('result');
    const thumbnailImg = document.getElementById('thumbnail');
    const videoTitle = document.getElementById('video-title');
    const videoDuration = document.getElementById('video-duration');
    const downloadButton = document.getElementById('download-button');
    const loadingScreen = document.getElementById('loading');
    
    // Variáveis de estado
    let selectedFormat = 'mp3';
    let currentVideoUrl = '';
    let isConverting = false;
    
    // URL base da API (ajuste para produção se necessário)
    const API_BASE_URL = window.location.origin + '/api';
    
    // Event Listeners
    pasteButton.addEventListener('click', async function() {
        try {
            const text = await navigator.clipboard.readText();
            youtubeUrlInput.value = text;
            // Auto-validar após colar
            validateYoutubeUrl(text);
        } catch (err) {
            showToast('Permissão para acessar a área de transferência negada. Por favor, cole o link manualmente.', 'error');
        }
    });
    
    // Validar ao digitar/colar
    youtubeUrlInput.addEventListener('input', function(e) {
        const url = e.target.value.trim();
        if (url.length > 10) { // Apenas validar se tiver um tamanho mínimo
            validateYoutubeUrl(url);
        }
    });
    
    mp3Button.addEventListener('click', function() {
        selectedFormat = 'mp3';
        mp3Button.classList.add('active');
        mp4Button.classList.remove('active');
    });
    
    mp4Button.addEventListener('click', function() {
        selectedFormat = 'mp4';
        mp4Button.classList.add('active');
        mp3Button.classList.remove('active');
    });
    
    convertButton.addEventListener('click', async function() {
        if (isConverting) return;
        
        const youtubeUrl = youtubeUrlInput.value.trim();
        
        if (!youtubeUrl) {
            showToast('Por favor, insira um link do YouTube válido.', 'error');
            return;
        }
        
        // Iniciar conversão
        isConverting = true;
        convertButton.disabled = true;
        loadingScreen.classList.remove('hidden');
        resultContainer.classList.add('hidden');
        
        try {
            // Verificar se a URL é válida
            const validateResponse = await fetch(`${API_BASE_URL}/validate?url=${encodeURIComponent(youtubeUrl)}`);
            const validateData = await validateResponse.json();
            
            if (!validateData.valid) {
                throw new Error('URL do YouTube inválida');
            }
            
            // Obter informações do vídeo
            const infoResponse = await fetch(`${API_BASE_URL}/info?url=${encodeURIComponent(youtubeUrl)}`);
            
            if (!infoResponse.ok) {
                throw new Error('Falha ao obter informações do vídeo');
            }
            
            const videoInfo = await infoResponse.json();
            
            // Verificar se o vídeo não é muito longo (opcional)
            if (videoInfo.durationSeconds > 7200) { // Limitar a 2 horas
                showToast('Vídeos com mais de 2 horas não são suportados.', 'error');
                throw new Error('Vídeo muito longo');
            }
            
            // Atualizar a UI com as informações do vídeo
            thumbnailImg.src = videoInfo.thumbnail;
            videoTitle.textContent = videoInfo.title;
            videoDuration.textContent = videoInfo.duration;
            
            // Exibir informações adicionais se disponíveis
            const additionalInfo = document.getElementById('additional-info');
            if (additionalInfo && videoInfo.author) {
                additionalInfo.textContent = `${videoInfo.author} • ${formatViewCount(videoInfo.viewCount)} visualizações`;
            }
            
            // Salvar URL atual para download
            currentVideoUrl = youtubeUrl;
            
            // Esconder tela de carregamento e mostrar resultado
            loadingScreen.classList.add('hidden');
            resultContainer.classList.remove('hidden');
            
            // Atualizar texto do botão de download
            downloadButton.innerHTML = `<i class="fas fa-download"></i> Baixar ${selectedFormat.toUpperCase()}`;
            
            // Scroll para resultado
            resultContainer.scrollIntoView({ behavior: 'smooth' });
            
        } catch (error) {
            loadingScreen.classList.add('hidden');
            showToast(`Erro: ${error.message || 'Falha ao processar o vídeo'}`, 'error');
        } finally {
            isConverting = false;
            convertButton.disabled = false;
        }
    });
    
    downloadButton.addEventListener('click', function() {
        if (!currentVideoUrl) {
            showToast('Nenhum vídeo selecionado para download.', 'error');
            return;
        }
        
        // Mostrar indicador de download
        downloadButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparando...';
        downloadButton.disabled = true;
        
        // Redirecionar para a API de download
        const downloadUrl = `${API_BASE_URL}/download/${selectedFormat}?url=${encodeURIComponent(currentVideoUrl)}`;
        
        // Usar iframe para download sem redirecionar a página
        const downloadFrame = document.createElement('iframe');
        downloadFrame.style.display = 'none';
        downloadFrame.src = downloadUrl;
        document.body.appendChild(downloadFrame);
        
        // Restaurar botão após um tempo
        setTimeout(() => {
            downloadButton.innerHTML = `<i class="fas fa-download"></i> Baixar ${selectedFormat.toUpperCase()}`;
            downloadButton.disabled = false;
            
            // Limpar iframe após o download iniciar
            setTimeout(() => {
                document.body.removeChild(downloadFrame);
            }, 1000);
            
        }, 2000);
    });
    
    // Verificar se o navegador suporta a API Clipboard
    if (!navigator.clipboard || !navigator.clipboard.readText) {
        pasteButton.style.display = 'none';
    }
    
    // Funções auxiliares
    async function validateYoutubeUrl(url) {
        if (!url || url.length < 10) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/validate?url=${encodeURIComponent(url)}`);
            const data = await response.json();
            
            if (data.valid) {
                youtubeUrlInput.classList.add('valid-url');
                youtubeUrlInput.classList.remove('invalid-url');
            } else {
                youtubeUrlInput.classList.add('invalid-url');
                youtubeUrlInput.classList.remove('valid-url');
            }
        } catch (error) {
            console.error('Erro na validação:', error);
        }
    }
    
    function formatViewCount(count) {
        if (!count) return '';
        
        const num = parseInt(count);
        if (isNaN(num)) return count;
        
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        
        return num.toString();
    }
    
    function showToast(message, type = 'info') {
        // Criar toast se não existir
        let toastContainer = document.querySelector('.toast-container');
        
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        toastContainer.appendChild(toast);
        
        // Animar entrada
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // Remover após 3 segundos
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toastContainer.removeChild(toast);
            }, 300);
        }, 3000);
    }
});
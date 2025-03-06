// server.js - Implementação completa do backend com tratamento de erros e otimizações

const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const app = express();
const PORT = process.env.PORT || 3000;

// Configuração de diretórios
const downloadsFolder = path.join(__dirname, 'downloads');
const tempFolder = path.join(__dirname, 'temp');

// Criação das pastas necessárias se não existirem
[downloadsFolder, tempFolder].forEach(folder => {
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder);
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Limpeza periódica dos arquivos temporários (a cada 1 hora)
setInterval(() => {
    cleanTempFolder();
}, 3600000);

// Servir os arquivos estáticos do frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para verificar se o URL do YouTube é válido
app.get('/api/validate', async (req, res) => {
    const videoUrl = req.query.url;
    
    if (!videoUrl) {
        return res.status(400).json({ valid: false, error: 'URL não fornecida' });
    }
    
    try {
        const isValid = await ytdl.validateURL(videoUrl);
        res.json({ valid: isValid });
    } catch (error) {
        console.error('Erro na validação:', error);
        res.json({ valid: false, error: error.message });
    }
});

// Rota para obter informações do vídeo
app.get('/api/info', async (req, res) => {
    try {
        const videoUrl = req.query.url;
        
        if (!videoUrl) {
            return res.status(400).json({ error: 'URL do vídeo é obrigatória' });
        }
        
        const info = await ytdl.getInfo(videoUrl);
        
        res.json({
            videoId: info.videoDetails.videoId,
            title: info.videoDetails.title,
            duration: formatDuration(info.videoDetails.lengthSeconds),
            durationSeconds: info.videoDetails.lengthSeconds,
            thumbnail: info.videoDetails.thumbnails.slice(-1)[0].url,
            author: info.videoDetails.author.name,
            viewCount: info.videoDetails.viewCount
        });
    } catch (error) {
        console.error('Erro ao obter informações do vídeo:', error);
        res.status(500).json({ error: 'Falha ao processar o vídeo. ' + error.message });
    }
});

// Rota para download de MP3
app.get('/api/download/mp3', async (req, res) => {
    try {
        const videoUrl = req.query.url;
        
        if (!videoUrl) {
            return res.status(400).json({ error: 'URL do vídeo é obrigatória' });
        }
        
        const info = await ytdl.getInfo(videoUrl);
        const title = sanitizeFilename(info.videoDetails.title);
        const fileName = `${title}.mp3`;
        
        res.header('Content-Disposition', `attachment; filename="${fileName}"`);
        res.header('Content-Type', 'audio/mpeg');
        
        // Selecionar a melhor qualidade de áudio
        const audioFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });
        
        if (!audioFormat) {
            throw new Error('Não foi possível encontrar um formato de áudio adequado');
        }
        
        ytdl(videoUrl, { format: audioFormat })
            .on('error', (err) => {
                console.error('Erro no stream do ytdl:', err);
                if (!res.headersSent) {
                    res.status(500).send('Erro ao processar o download do áudio');
                }
            })
            .pipe(res)
            .on('error', (err) => {
                console.error('Erro no stream de resposta:', err);
            });
    } catch (error) {
        console.error('Erro ao baixar MP3:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Falha ao converter para MP3: ' + error.message });
        }
    }
});

// Rota para download de MP4
app.get('/api/download/mp4', async (req, res) => {
    try {
        const videoUrl = req.query.url;
        
        if (!videoUrl) {
            return res.status(400).json({ error: 'URL do vídeo é obrigatória' });
        }
        
        const info = await ytdl.getInfo(videoUrl);
        const title = sanitizeFilename(info.videoDetails.title);
        const fileName = `${title}.mp4`;
        
        res.header('Content-Disposition', `attachment; filename="${fileName}"`);
        res.header('Content-Type', 'video/mp4');
        
        // Selecionar formato com áudio e vídeo (mp4)
        const format = ytdl.chooseFormat(info.formats, { 
            quality: 'highest',
            filter: format => format.container === 'mp4' && format.hasAudio && format.hasVideo
        });
        
        if (!format) {
            throw new Error('Não foi possível encontrar um formato de vídeo adequado');
        }
        
        ytdl(videoUrl, { format: format })
            .on('error', (err) => {
                console.error('Erro no stream do ytdl:', err);
                if (!res.headersSent) {
                    res.status(500).send('Erro ao processar o download do vídeo');
                }
            })
            .pipe(res)
            .on('error', (err) => {
                console.error('Erro no stream de resposta:', err);
            });
    } catch (error) {
        console.error('Erro ao baixar MP4:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Falha ao converter para MP4: ' + error.message });
        }
    }
});

// Rota para lidar com erros 404
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Funções auxiliares
function sanitizeFilename(filename) {
    return filename
        .replace(/[^\w\s\-\.]/gi, '_')
        .replace(/\s+/g, '_')
        .substring(0, 100);
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
        return `${hours}:${minutes < 10 ? '0' : ''}${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    } else {
        return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    }
}

function cleanTempFolder() {
    fs.readdir(tempFolder, (err, files) => {
        if (err) {
            console.error('Erro ao limpar pasta temporária:', err);
            return;
        }
        
        const now = Date.now();
        
        files.forEach(file => {
            const filePath = path.join(tempFolder, file);
            
            fs.stat(filePath, (err, stats) => {
                if (err) {
                    console.error(`Erro ao obter estatísticas do arquivo ${file}:`, err);
                    return;
                }
                
                // Remover arquivos com mais de 1 hora
                if (now - stats.mtimeMs > 3600000) {
                    fs.unlink(filePath, err => {
                        if (err) {
                            console.error(`Erro ao excluir arquivo temporário ${file}:`, err);
                        }
                    });
                }
            });
        });
    });
}

// Iniciar o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Diretório de downloads: ${downloadsFolder}`);
});
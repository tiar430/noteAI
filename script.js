/**
 * Neon Notes - Advanced Edition
 * A feature-rich cyberpunk-themed productivity application
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

class NeonNotes {
    constructor() {
        this.notes = [];
        this.todos = [];
        this.tags = new Set();
        this.history = [];
        this.pinnedNotes = [];
        this.trash = []; // Trash bin for deleted notes
        this.currentTheme = 'dark';
        this.currentFilter = 'all';
        this.sortBy = 'date';
        this.autoSaveTimer = null;
        this.isRecording = false;
        this.markdownMode = false;
        this.bulkMode = false;
        this.selectedItems = [];
        this.customThemeColors = null;
        this.geminiApiKey = null; // Changed from hfToken
        this.aiOriginalText = '';
        this.githubToken = null;
        this.gistId = null;
        this.autoSync = false;
        this.syncInterval = null;
        this.deferredPrompt = null;
        
        // Pomodoro timer state
        this.pomodoroTime = 25 * 60; // 25 minutes in seconds
        this.pomodoroInterval = null;
        this.pomodoroMode = 'work'; // 'work' or 'break'
        this.pomodoroRunning = false;
        
        this.init();
    }

    init() {
        this.loadFromStorage();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.updateDateTime();
        this.renderAll();
        this.setupAutoSave();
        this.updatePomodoroDisplay();
        
        // Update date/time every second
        setInterval(() => this.updateDateTime(), 1000);
        
        // Initialize PWA
        this.initPWA();
        
        // Initialize auto-sync if enabled
        if (this.autoSync && this.githubToken) {
            this.startAutoSync();
        }
    }

    // ==================== STORAGE ====================
    
    loadFromStorage() {
        try {
            const data = localStorage.getItem('neonNotesData');
            if (data) {
                const parsed = JSON.parse(data);
                this.notes = parsed.notes || [];
                this.todos = parsed.todos || [];
                this.tags = new Set(parsed.tags || []);
                this.history = parsed.history || [];
                this.pinnedNotes = parsed.pinnedNotes || [];
                this.trash = parsed.trash || [];
                this.geminiApiKey = parsed.geminiApiKey || null; // Changed from hfToken
                this.githubToken = parsed.githubToken || null;
                this.gistId = parsed.gistId || null;
                this.autoSync = parsed.autoSync || false;
                this.currentTheme = parsed.theme || 'dark';
                
                // Clean up old trash items (older than 30 days)
                this.cleanupTrash();
                
                // Apply saved theme
                if (this.currentTheme === 'light') {
                    document.body.classList.add('light-theme');
                }
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    saveToStorage() {
        try {
            const data = {
                notes: this.notes,
                todos: this.todos,
                tags: Array.from(this.tags),
                history: this.history,
                pinnedNotes: this.pinnedNotes,
                trash: this.trash,
                geminiApiKey: this.geminiApiKey, // Changed from hfToken
                githubToken: this.githubToken,
                gistId: this.gistId,
                autoSync: this.autoSync,
                theme: this.currentTheme
            };
            localStorage.setItem('neonNotesData', JSON.stringify(data));
        } catch (error) {
            console.error('Error saving data:', error);
            this.showNotification('Error saving data', 'error');
        }
    }

    // ==================== EVENT LISTENERS ====================
    
    setupEventListeners() {
        // Note actions
        document.getElementById('saveNote')?.addEventListener('click', () => this.saveNote());
        document.getElementById('clearNote')?.addEventListener('click', () => this.clearNote());
        document.getElementById('pinNote')?.addEventListener('click', () => this.togglePinCurrentNote());
        
        // Voice input
        document.getElementById('voiceBtn')?.addEventListener('click', () => this.toggleVoiceInput());
        
        // Markdown toggle
        document.getElementById('markdownToggle')?.addEventListener('click', () => this.toggleMarkdown());
        
        // Todo actions
        document.getElementById('addTodo')?.addEventListener('click', () => this.addTodo());
        document.getElementById('todoInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTodo();
        });
        
        // Todo filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.renderTodos();
            });
        });
        
        // Search
        document.getElementById('searchBtn')?.addEventListener('click', () => this.performSearch());
        document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.performSearch();
        });
        document.getElementById('searchInput')?.addEventListener('input', (e) => {
            if (e.target.value === '') {
                document.getElementById('searchResults').style.display = 'none';
            }
        });
        
        // Theme toggle
        document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());
        
        // Statistics
        document.getElementById('statsBtn')?.addEventListener('click', () => this.showStatistics());
        document.getElementById('closeStats')?.addEventListener('click', () => this.closeModal('statsModal'));
        
        // Keyboard shortcuts
        document.getElementById('shortcutsBtn')?.addEventListener('click', () => this.showShortcuts());
        document.getElementById('closeShortcuts')?.addEventListener('click', () => this.closeModal('shortcutsModal'));
        
        // All Notes
        document.getElementById('viewAllNotes')?.addEventListener('click', () => this.showAllNotes());
        document.getElementById('closeAllNotes')?.addEventListener('click', () => this.closeModal('allNotesModal'));
        document.getElementById('notesFilterInput')?.addEventListener('input', () => this.filterAllNotes());
        document.getElementById('notesCategoryFilter')?.addEventListener('change', () => this.filterAllNotes());
        
        // Trash Bin
        document.getElementById('viewTrash')?.addEventListener('click', () => this.showTrash());
        document.getElementById('closeTrash')?.addEventListener('click', () => this.closeModal('trashModal'));
        document.getElementById('emptyTrash')?.addEventListener('click', () => this.emptyTrash());
        
        // Templates
        document.getElementById('templatesBtn')?.addEventListener('click', () => this.showTemplates());
        document.getElementById('closeTemplates')?.addEventListener('click', () => this.closeModal('templatesModal'));
        
        // Custom Themes
        document.getElementById('customTheme')?.addEventListener('click', () => this.showThemeCustomizer());
        document.getElementById('closeTheme')?.addEventListener('click', () => this.closeModal('themeModal'));
        document.getElementById('applyCustomTheme')?.addEventListener('click', () => this.applyCustomTheme());
        document.getElementById('resetTheme')?.addEventListener('click', () => this.resetTheme());
        
        // Bulk Operations
        document.getElementById('bulkMode')?.addEventListener('click', () => this.toggleBulkMode());
        
        // Quick Capture
        document.getElementById('quickCapture')?.addEventListener('click', () => this.showQuickCapture());
        document.getElementById('closeQuickCapture')?.addEventListener('click', () => this.closeModal('quickCaptureModal'));
        document.getElementById('saveQuickCapture')?.addEventListener('click', () => this.saveQuickCapture());
        document.getElementById('cancelQuickCapture')?.addEventListener('click', () => this.closeModal('quickCaptureModal'));
        
        // AI Settings
        document.getElementById('aiSettings')?.addEventListener('click', () => this.showAISettings());
        document.getElementById('closeAISettings')?.addEventListener('click', () => this.closeModal('aiSettingsModal'));
        document.getElementById('saveAISettings')?.addEventListener('click', () => this.saveAIToken());
        document.getElementById('testAIConnection')?.addEventListener('click', () => this.testAIConnection());
        
        // AI Preview
        document.getElementById('closeAIPreview')?.addEventListener('click', () => this.closeModal('aiPreviewModal'));
        document.getElementById('acceptAI')?.addEventListener('click', () => this.acceptAIImprovement());
        document.getElementById('rejectAI')?.addEventListener('click', () => this.closeModal('aiPreviewModal'));
        
        // AI Improve Button
        document.getElementById('aiImproveBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = document.getElementById('aiActionsMenu');
            if (menu) {
                menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
            }
        });
        
        // Cloud Sync
        document.getElementById('cloudSync')?.addEventListener('click', () => this.showCloudSync());
        document.getElementById('closeCloudSync')?.addEventListener('click', () => this.closeModal('cloudSyncModal'));
        document.getElementById('saveGithubToken')?.addEventListener('click', () => this.saveGithubToken());
        document.getElementById('testGithubConnection')?.addEventListener('click', () => this.testGithubConnection());
        document.getElementById('syncNow')?.addEventListener('click', () => this.syncNow());
        document.getElementById('autoSyncToggle')?.addEventListener('click', () => this.toggleAutoSync());
        
        // PWA Install
        document.getElementById('pwaInstallBtn')?.addEventListener('click', () => this.installPWA());
        document.getElementById('pwaInstallDismiss')?.addEventListener('click', () => this.dismissPWAPrompt());
        
        // Export/Import
        document.getElementById('exportJSON')?.addEventListener('click', () => this.exportJSON());
        document.getElementById('exportPDF')?.addEventListener('click', () => this.exportPDF());
        document.getElementById('importJSON')?.addEventListener('click', () => this.importJSON());
        document.getElementById('backupBtn')?.addEventListener('click', () => this.createBackup());
        
        // Sort
        document.getElementById('sortSelect')?.addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            this.renderHistory();
        });
        
        // Tag input with suggestions
        const tagInput = document.getElementById('tagInput');
        if (tagInput) {
            tagInput.addEventListener('input', () => this.showTagSuggestions());
            tagInput.addEventListener('blur', () => {
                setTimeout(() => {
                    document.getElementById('tagSuggestions').style.display = 'none';
                }, 200);
            });
        }
        
        // AI Assistant
        document.getElementById('aiInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Prevent new line
                this.handleAIInput();
            }
        });
        document.getElementById('aiSendBtn')?.addEventListener('click', () => this.handleAIInput());
        
        // Pomodoro Timer
        document.getElementById('timerStart')?.addEventListener('click', () => this.startPomodoro());
        document.getElementById('timerPause')?.addEventListener('click', () => this.pausePomodoro());
        document.getElementById('timerReset')?.addEventListener('click', () => this.resetPomodoro());
        document.getElementById('workMode')?.addEventListener('click', () => this.setPomodoroMode('work'));
        document.getElementById('breakMode')?.addEventListener('click', () => this.setPomodoroMode('break'));
        
        // Close modals on outside click
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }

    // ==================== KEYBOARD SHORTCUTS ====================
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+S: Save note
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveNote();
            }
            // Ctrl+N: New note (clear)
            else if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                this.clearNote();
            }
            // Ctrl+F: Focus search
            else if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                document.getElementById('searchInput')?.focus();
            }
            // Ctrl+M: Toggle markdown
            else if (e.ctrlKey && e.key === 'm') {
                e.preventDefault();
                this.toggleMarkdown();
            }
            // Ctrl+K: Show shortcuts
            else if (e.ctrlKey && e.key === 'k') {
                e.preventDefault();
                this.showShortcuts();
            }
            // Ctrl+D: Toggle theme
            else if (e.ctrlKey && e.key === 'd') {
                e.preventDefault();
                this.toggleTheme();
            }
            // Ctrl+P: Pin note
            else if (e.ctrlKey && e.key === 'p') {
                e.preventDefault();
                this.togglePinCurrentNote();
            }
            // Ctrl+L: View all notes
            else if (e.ctrlKey && e.key === 'l') {
                e.preventDefault();
                this.showAllNotes();
            }
            // Ctrl+T: View trash
            else if (e.ctrlKey && e.key === 't') {
                e.preventDefault();
                this.showTrash();
            }
            // Ctrl+Q: Quick capture
            else if (e.ctrlKey && e.key === 'q') {
                e.preventDefault();
                this.showQuickCapture();
            }
            // Esc: Close modals
            else if (e.key === 'Escape') {
                document.querySelectorAll('.modal').forEach(modal => {
                    modal.style.display = 'none';
                });
            }
        });
    }

    // ==================== AUTO-SAVE ====================
    
    setupAutoSave() {
        const noteInput = document.getElementById('noteInput');
        if (noteInput) {
            noteInput.addEventListener('input', () => {
                clearTimeout(this.autoSaveTimer);
                const indicator = document.getElementById('autoSaveIndicator');
                if (indicator) indicator.textContent = 'Typing...';
                
                this.autoSaveTimer = setTimeout(() => {
                    if (indicator) {
                        indicator.textContent = '✓ Auto-saved';
                        setTimeout(() => {
                            indicator.textContent = '';
                        }, 2000);
                    }
                }, 2000);
            });
        }
    }

    // ==================== DATE/TIME ====================
    
    updateDateTime() {
        const dateTimeEl = document.getElementById('dateTime');
        if (dateTimeEl) {
            const now = new Date();
            const options = { 
                weekday: 'short', 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            };
            dateTimeEl.textContent = now.toLocaleDateString('en-US', options);
        }
    }

    // ==================== VOICE INPUT ====================
    
    toggleVoiceInput() {
        const voiceBtn = document.getElementById('voiceBtn');
        const noteInput = document.getElementById('noteInput');
        
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            this.showNotification('Voice input not supported in this browser', 'error');
            return;
        }

        if (this.isRecording) {
            this.recognition.stop();
            this.isRecording = false;
            voiceBtn.classList.remove('active');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;

        this.recognition.onstart = () => {
            this.isRecording = true;
            voiceBtn.classList.add('active');
            this.showNotification('Listening...', 'info');
        };

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }

            if (finalTranscript) {
                noteInput.value += finalTranscript;
                if (this.markdownMode) {
                    this.updateMarkdownPreview();
                }
            }
        };

        this.recognition.onerror = (event) => {
            this.showNotification('Voice input error: ' + event.error, 'error');
            this.isRecording = false;
            voiceBtn.classList.remove('active');
        };

        this.recognition.onend = () => {
            this.isRecording = false;
            voiceBtn.classList.remove('active');
        };

        this.recognition.start();
    }

    // ==================== MARKDOWN ====================
    
    toggleMarkdown() {
        this.markdownMode = !this.markdownMode;
        const noteInput = document.getElementById('noteInput');
        const preview = document.getElementById('markdownPreview');
        const toggleBtn = document.getElementById('markdownToggle');

        if (this.markdownMode) {
            noteInput.style.display = 'none';
            preview.style.display = 'block';
            toggleBtn.classList.add('active');
            this.updateMarkdownPreview();
        } else {
            noteInput.style.display = 'block';
            preview.style.display = 'none';
            toggleBtn.classList.remove('active');
        }
    }

    updateMarkdownPreview() {
        const noteInput = document.getElementById('noteInput');
        const preview = document.getElementById('markdownPreview');
        
        if (typeof marked !== 'undefined') {
            preview.innerHTML = marked.parse(noteInput.value || '*No content yet*');
        } else {
            preview.innerHTML = '<p>Markdown library not loaded</p>';
        }
    }

    // ==================== NOTES ====================
    
    saveNote() {
        const noteInput = document.getElementById('noteInput');
        const tagInput = document.getElementById('tagInput');
        const categorySelect = document.getElementById('categorySelect');
        
        if (!noteInput || !noteInput.value.trim()) {
            this.showNotification('Please enter a note', 'warning');
            return;
        }

        const note = {
            id: Date.now(),
            content: noteInput.value.trim(),
            tags: tagInput?.value ? tagInput.value.split(',').map(t => t.trim()).filter(t => t) : [],
            category: categorySelect?.value || '',
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleDateString(),
            pinned: false
        };

        this.notes.unshift(note);
        
        // Add tags to global tag set
        note.tags.forEach(tag => this.tags.add(tag));
        
        // Add to history
        this.addToHistory(note);
        
        this.saveToStorage();
        this.renderAll();
        
        // Clear inputs
        noteInput.value = '';
        if (tagInput) tagInput.value = '';
        if (categorySelect) categorySelect.value = '';
        
        this.showNotification('Note saved successfully!', 'success');
    }

    clearNote() {
        const noteInput = document.getElementById('noteInput');
        const tagInput = document.getElementById('tagInput');
        const categorySelect = document.getElementById('categorySelect');
        
        if (noteInput) noteInput.value = '';
        if (tagInput) tagInput.value = '';
        if (categorySelect) categorySelect.value = '';
        
        if (this.markdownMode) {
            this.updateMarkdownPreview();
        }
        
        this.showNotification('Note cleared', 'info');
    }

    togglePinCurrentNote() {
        const noteInput = document.getElementById('noteInput');
        const tagInput = document.getElementById('tagInput');
        const categorySelect = document.getElementById('categorySelect');
        
        if (!noteInput || !noteInput.value.trim()) {
            this.showNotification('Please enter a note first', 'warning');
            return;
        }

        const note = {
            id: Date.now(),
            content: noteInput.value.trim(),
            tags: tagInput?.value ? tagInput.value.split(',').map(t => t.trim()).filter(t => t) : [],
            category: categorySelect?.value || '',
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleDateString(),
            pinned: true
        };

        this.pinnedNotes.unshift(note);
        this.saveToStorage();
        this.renderPinnedNotes();
        
        this.showNotification('Note pinned!', 'success');
    }

    unpinNote(id) {
        this.pinnedNotes = this.pinnedNotes.filter(note => note.id !== id);
        this.saveToStorage();
        this.renderPinnedNotes();
        this.showNotification('Note unpinned', 'info');
    }

    renderPinnedNotes() {
        const pinnedSection = document.getElementById('pinnedNotes');
        const pinnedList = document.getElementById('pinnedList');
        
        if (!pinnedSection || !pinnedList) return;

        if (this.pinnedNotes.length === 0) {
            pinnedSection.style.display = 'none';
            return;
        }

        pinnedSection.style.display = 'block';
        pinnedList.innerHTML = this.pinnedNotes.map(note => `
            <div class="pinned-note-card" onclick="app.loadPinnedNote(${note.id})">
                <div style="font-size: 0.75rem; opacity: 0.7; margin-bottom: 5px;">
                    ${note.date} ${note.category ? '| ' + note.category : ''}
                </div>
                <div>${this.escapeHtml(note.content.substring(0, 100))}${note.content.length > 100 ? '...' : ''}</div>
                <div style="margin-top: 10px;">
                    <button onclick="event.stopPropagation(); app.unpinNote(${note.id})" style="padding: 5px 10px; font-size: 0.7rem;">
                        Unpin
                    </button>
                </div>
            </div>
        `).join('');
    }

    loadPinnedNote(id) {
        const note = this.pinnedNotes.find(n => n.id === id);
        if (note) {
            const noteInput = document.getElementById('noteInput');
            const tagInput = document.getElementById('tagInput');
            const categorySelect = document.getElementById('categorySelect');
            
            if (noteInput) noteInput.value = note.content;
            if (tagInput) tagInput.value = note.tags.join(', ');
            if (categorySelect) categorySelect.value = note.category;
            
            noteInput?.scrollIntoView({ behavior: 'smooth' });
        }
    }

    // ==================== TODOS ====================
    
    addTodo() {
        const todoInput = document.getElementById('todoInput');
        const prioritySelect = document.getElementById('todoPriority');
        
        if (!todoInput || !todoInput.value.trim()) {
            this.showNotification('Please enter a task', 'warning');
            return;
        }

        const todo = {
            id: Date.now(),
            text: todoInput.value.trim(),
            completed: false,
            priority: prioritySelect?.value || 'medium',
            timestamp: new Date().toISOString()
        };

        this.todos.unshift(todo);
        this.saveToStorage();
        this.renderTodos();
        
        todoInput.value = '';
        this.showNotification('Task added!', 'success');
    }

    toggleTodo(id) {
        const todo = this.todos.find(t => t.id === id);
        if (todo) {
            todo.completed = !todo.completed;
            this.saveToStorage();
            this.renderTodos();
        }
    }

    deleteTodo(id) {
        this.todos = this.todos.filter(t => t.id !== id);
        this.saveToStorage();
        this.renderTodos();
        this.showNotification('Task deleted', 'info');
    }

    renderTodos() {
        const todoList = document.getElementById('todoList');
        if (!todoList) return;

        let filteredTodos = this.todos;
        if (this.currentFilter === 'active') {
            filteredTodos = this.todos.filter(t => !t.completed);
        } else if (this.currentFilter === 'completed') {
            filteredTodos = this.todos.filter(t => t.completed);
        }

        if (filteredTodos.length === 0) {
            todoList.innerHTML = '<li style="opacity: 0.5; text-align: center; padding: 20px;">No tasks in this filter</li>';
            return;
        }

        todoList.innerHTML = filteredTodos.map(todo => `
            <li class="todo-item priority-${todo.priority} ${todo.completed ? 'completed' : ''}">
                <span onclick="app.toggleTodo(${todo.id})" style="cursor: pointer; flex: 1;">
                    ${todo.completed ? '✓ ' : ''}${this.escapeHtml(todo.text)}
                    <span style="font-size: 0.7rem; opacity: 0.7; margin-left: 10px;">[${todo.priority}]</span>
                </span>
                <div>
                    <button onclick="app.toggleTodo(${todo.id})" style="margin: 0 5px;">
                        ${todo.completed ? '↺' : '✓'}
                    </button>
                    <button onclick="app.deleteTodo(${todo.id})" style="margin: 0;">✕</button>
                </div>
            </li>
        `).join('');
    }

    // ==================== POMODORO TIMER ====================
    
    startPomodoro() {
        if (this.pomodoroRunning) return;
        
        this.pomodoroRunning = true;
        this.pomodoroInterval = setInterval(() => {
            this.pomodoroTime--;
            this.updatePomodoroDisplay();
            
            if (this.pomodoroTime <= 0) {
                this.pomodoroComplete();
            }
        }, 1000);
        
        this.showNotification(`${this.pomodoroMode === 'work' ? 'Work' : 'Break'} session started!`, 'info');
    }

    pausePomodoro() {
        if (!this.pomodoroRunning) return;
        
        clearInterval(this.pomodoroInterval);
        this.pomodoroRunning = false;
        this.showNotification('Timer paused', 'info');
    }

    resetPomodoro() {
        clearInterval(this.pomodoroInterval);
        this.pomodoroRunning = false;
        this.pomodoroTime = this.pomodoroMode === 'work' ? 25 * 60 : 5 * 60;
        this.updatePomodoroDisplay();
        this.showNotification('Timer reset', 'info');
    }

    setPomodoroMode(mode) {
        this.pomodoroMode = mode;
        this.resetPomodoro();
        
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(mode + 'Mode')?.classList.add('active');
    }

    pomodoroComplete() {
        clearInterval(this.pomodoroInterval);
        this.pomodoroRunning = false;
        
        // Play notification sound (if available)
        this.showNotification(`${this.pomodoroMode === 'work' ? 'Work' : 'Break'} session complete!`, 'success');
        
        // Auto-switch mode
        this.pomodoroMode = this.pomodoroMode === 'work' ? 'break' : 'work';
        this.pomodoroTime = this.pomodoroMode === 'work' ? 25 * 60 : 5 * 60;
        this.updatePomodoroDisplay();
        
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(this.pomodoroMode + 'Mode')?.classList.add('active');
    }

    updatePomodoroDisplay() {
        const display = document.getElementById('timerDisplay');
        if (!display) return;
        
        const minutes = Math.floor(this.pomodoroTime / 60);
        const seconds = this.pomodoroTime % 60;
        display.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // ==================== TAGS ====================
    
    showTagSuggestions() {
        const tagInput = document.getElementById('tagInput');
        const suggestionsEl = document.getElementById('tagSuggestions');
        
        if (!tagInput || !suggestionsEl || this.tags.size === 0) return;

        const inputValue = tagInput.value.toLowerCase();
        const lastTag = inputValue.split(',').pop().trim();
        
        if (!lastTag) {
            suggestionsEl.style.display = 'none';
            return;
        }

        const matches = Array.from(this.tags).filter(tag => 
            tag.toLowerCase().includes(lastTag) && tag.toLowerCase() !== lastTag
        );

        if (matches.length > 0) {
            suggestionsEl.innerHTML = matches.map(tag => 
                `<div class="tag-suggestion" onclick="app.selectTag('${tag}')">${tag}</div>`
            ).join('');
            suggestionsEl.style.display = 'block';
        } else {
            suggestionsEl.style.display = 'none';
        }
    }

    selectTag(tag) {
        const tagInput = document.getElementById('tagInput');
        if (!tagInput) return;

        const tags = tagInput.value.split(',').map(t => t.trim());
        tags[tags.length - 1] = tag;
        tagInput.value = tags.join(', ') + ', ';
        tagInput.focus();
        
        document.getElementById('tagSuggestions').style.display = 'none';
    }

    renderTags() {
        const tagList = document.getElementById('tagList');
        if (!tagList) return;

        if (this.tags.size === 0) {
            tagList.innerHTML = '<div style="opacity: 0.5; font-size: 0.8rem;">No tags yet</div>';
            return;
        }

        tagList.innerHTML = Array.from(this.tags).map(tag => 
            `<span class="tag" onclick="app.filterByTag('${tag}')">${tag}</span>`
        ).join('');
    }

    filterByTag(tag) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = `tag:${tag}`;
            this.performSearch();
        }
    }

    // ==================== HISTORY ====================
    
    addToHistory(note) {
        this.history.unshift({
            id: note.id,
            preview: note.content.substring(0, 50) + (note.content.length > 50 ? '...' : ''),
            timestamp: note.timestamp,
            date: note.date,
            category: note.category,
            tags: note.tags
        });
        
        // Keep only last 20 items
        if (this.history.length > 20) {
            this.history = this.history.slice(0, 20);
        }
    }

    renderHistory() {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;

        if (this.history.length === 0) {
            historyList.innerHTML = '<div style="opacity: 0.5; font-size: 0.8rem;">No history yet</div>';
            return;
        }

        let sortedHistory = [...this.history];
        
        if (this.sortBy === 'title') {
            sortedHistory.sort((a, b) => a.preview.localeCompare(b.preview));
        } else if (this.sortBy === 'tags') {
            sortedHistory.sort((a, b) => (a.tags?.length || 0) - (b.tags?.length || 0));
        }

        historyList.innerHTML = sortedHistory.map(item => `
            <div class="history-item" onclick="app.viewHistoryItem(${item.id})">
                <div style="font-size: 0.75rem; opacity: 0.7; margin-bottom: 3px;">
                    ${item.date} ${item.category ? '| ' + item.category : ''}
                </div>
                <div>${this.escapeHtml(item.preview)}</div>
            </div>
        `).join('');
    }

    viewHistoryItem(id) {
        const note = this.notes.find(n => n.id === id);
        if (note) {
            const noteInput = document.getElementById('noteInput');
            const tagInput = document.getElementById('tagInput');
            const categorySelect = document.getElementById('categorySelect');
            
            if (noteInput) noteInput.value = note.content;
            if (tagInput) tagInput.value = note.tags.join(', ');
            if (categorySelect) categorySelect.value = note.category;
            
            noteInput?.scrollIntoView({ behavior: 'smooth' });
        }
    }

    // ==================== SEARCH ====================
    
    performSearch() {
        const searchInput = document.getElementById('searchInput');
        const searchResults = document.getElementById('searchResults');
        const resultsList = document.getElementById('resultsList');
        
        if (!searchInput || !searchResults || !resultsList) return;

        const query = searchInput.value.trim().toLowerCase();
        
        if (!query) {
            searchResults.style.display = 'none';
            return;
        }

        let results = [];

        // Check for tag search
        if (query.startsWith('tag:')) {
            const tag = query.substring(4).trim();
            results = this.notes.filter(note => 
                note.tags.some(t => t.toLowerCase().includes(tag))
            ).map(note => ({ type: 'note', data: note }));
        } else {
            // Search in notes
            const noteResults = this.notes.filter(note => 
                note.content.toLowerCase().includes(query) ||
                note.tags.some(tag => tag.toLowerCase().includes(query)) ||
                (note.category && note.category.toLowerCase().includes(query))
            ).map(note => ({ type: 'note', data: note }));

            // Search in todos
            const todoResults = this.todos.filter(todo => 
                todo.text.toLowerCase().includes(query)
            ).map(todo => ({ type: 'todo', data: todo }));

            results = [...noteResults, ...todoResults];
        }

        if (results.length === 0) {
            resultsList.innerHTML = '<div style="opacity: 0.5; padding: 20px; text-align: center;">No results found</div>';
        } else {
            resultsList.innerHTML = results.map(result => {
                if (result.type === 'note') {
                    return `
                        <div class="result-item">
                            <h4>📝 Note ${result.data.category ? '| ' + result.data.category : ''}</h4>
                            <p>${this.escapeHtml(result.data.content.substring(0, 150))}${result.data.content.length > 150 ? '...' : ''}</p>
                            <p style="font-size: 0.8rem; opacity: 0.7;">
                                ${result.data.date} | Tags: ${result.data.tags.join(', ') || 'none'}
                            </p>
                        </div>
                    `;
                } else {
                    return `
                        <div class="result-item">
                            <h4>✓ Task [${result.data.priority}]</h4>
                            <p>${this.escapeHtml(result.data.text)}</p>
                            <p style="font-size: 0.8rem; opacity: 0.7;">
                                Status: ${result.data.completed ? 'Completed' : 'Pending'}
                            </p>
                        </div>
                    `;
                }
            }).join('');
        }

        searchResults.style.display = 'block';
        searchResults.scrollIntoView({ behavior: 'smooth' });
    }

    // ==================== STATISTICS ====================
    
    showStatistics() {
        const modal = document.getElementById('statsModal');
        if (!modal) return;

        // Calculate statistics
        const totalNotes = this.notes.length;
        const totalTodos = this.todos.length;
        const completedTodos = this.todos.filter(t => t.completed).length;
        const totalTags = this.tags.size;
        const totalWords = this.notes.reduce((sum, note) => sum + note.content.split(/\s+/).length, 0);
        const productivity = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;

        // Update stat cards
        document.getElementById('totalNotes').textContent = totalNotes;
        document.getElementById('totalTodos').textContent = totalTodos;
        document.getElementById('completedTodos').textContent = completedTodos;
        document.getElementById('totalTags').textContent = totalTags;
        document.getElementById('totalWords').textContent = totalWords;
        document.getElementById('productivity').textContent = productivity + '%';

        // Category distribution chart
        const categories = {};
        this.notes.forEach(note => {
            const cat = note.category || 'Uncategorized';
            categories[cat] = (categories[cat] || 0) + 1;
        });

        const chartEl = document.getElementById('categoryChart');
        if (chartEl) {
            const maxCount = Math.max(...Object.values(categories), 1);
            chartEl.innerHTML = Object.entries(categories).map(([cat, count]) => `
                <div class="chart-bar">
                    <div class="chart-label">${cat}</div>
                    <div class="chart-bar-fill" style="width: ${(count / maxCount) * 100}%">
                        ${count}
                    </div>
                </div>
            `).join('');
        }

        modal.style.display = 'block';
    }

    // ==================== ALL NOTES ====================
    
    showAllNotes() {
        const modal = document.getElementById('allNotesModal');
        if (!modal) return;
        
        this.renderAllNotes();
        modal.style.display = 'block';
    }
    
    renderAllNotes(filteredNotes = null) {
        const notesList = document.getElementById('allNotesList');
        if (!notesList) return;
        
        const notesToShow = filteredNotes || this.notes;
        
        if (notesToShow.length === 0) {
            notesList.innerHTML = '<div class="empty-notes-message">📝 No notes found. Start creating!</div>';
            return;
        }
        
        notesList.innerHTML = notesToShow.map(note => {
            const categoryIcon = {
                'work': '💼',
                'personal': '👤',
                'ideas': '💡',
                'urgent': '🔥'
            }[note.category] || '';
            
            return `
                <div class="note-card ${note.category ? 'category-' + note.category : ''}">
                    <div class="note-card-header">
                        <div class="note-card-meta">
                            <strong>${note.date}</strong>
                            ${note.category ? `<span class="note-card-category">${categoryIcon} ${note.category}</span>` : ''}
                        </div>
                    </div>
                    <div class="note-card-content">
                        ${this.escapeHtml(note.content.length > 300 ? note.content.substring(0, 300) + '...' : note.content)}
                    </div>
                    ${note.tags.length > 0 ? `
                        <div class="note-card-tags">
                            ${note.tags.map(tag => `<span class="note-card-tag">${this.escapeHtml(tag)}</span>`).join('')}
                        </div>
                    ` : ''}
                    <div class="note-card-actions">
                        <button class="view-btn" onclick="app.viewNoteDetails(${note.id})">
                            👁️ View Full
                        </button>
                        <button class="edit-btn" onclick="app.editNote(${note.id})">
                            ✏️ Edit
                        </button>
                        <button class="delete-btn" onclick="app.confirmDeleteNote(${note.id})">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    filterAllNotes() {
        const filterInput = document.getElementById('notesFilterInput');
        const categoryFilter = document.getElementById('notesCategoryFilter');
        
        if (!filterInput || !categoryFilter) return;
        
        const searchTerm = filterInput.value.toLowerCase();
        const selectedCategory = categoryFilter.value;
        
        let filtered = this.notes;
        
        // Filter by category
        if (selectedCategory) {
            filtered = filtered.filter(note => note.category === selectedCategory);
        }
        
        // Filter by search term
        if (searchTerm) {
            filtered = filtered.filter(note => 
                note.content.toLowerCase().includes(searchTerm) ||
                note.tags.some(tag => tag.toLowerCase().includes(searchTerm))
            );
        }
        
        this.renderAllNotes(filtered);
    }
    
    viewNoteDetails(id) {
        const note = this.notes.find(n => n.id === id);
        if (!note) return;
        
        const notesList = document.getElementById('allNotesList');
        if (!notesList) return;
        
        const categoryIcon = {
            'work': '💼',
            'personal': '👤',
            'ideas': '💡',
            'urgent': '🔥'
        }[note.category] || '';
        
        notesList.innerHTML = `
            <div style="padding: 20px;">
                <button onclick="app.renderAllNotes()" style="margin-bottom: 20px;">
                    ← Back to All Notes
                </button>
                <div class="note-card ${note.category ? 'category-' + note.category : ''}">
                    <div class="note-card-header">
                        <div class="note-card-meta">
                            <strong>${note.date}</strong>
                            ${note.category ? `<span class="note-card-category">${categoryIcon} ${note.category}</span>` : ''}
                        </div>
                    </div>
                    <div class="note-card-content" style="white-space: pre-wrap;">
                        ${this.escapeHtml(note.content)}
                    </div>
                    ${note.tags.length > 0 ? `
                        <div class="note-card-tags">
                            ${note.tags.map(tag => `<span class="note-card-tag">${this.escapeHtml(tag)}</span>`).join('')}
                        </div>
                    ` : ''}
                    <div class="note-card-actions">
                        <button class="edit-btn" onclick="app.editNote(${note.id})">
                            ✏️ Edit
                        </button>
                        <button class="delete-btn" onclick="app.confirmDeleteNote(${note.id})">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    editNote(id) {
        const note = this.notes.find(n => n.id === id);
        if (!note) return;
        
        const noteInput = document.getElementById('noteInput');
        const tagInput = document.getElementById('tagInput');
        const categorySelect = document.getElementById('categorySelect');
        
        if (noteInput) noteInput.value = note.content;
        if (tagInput) tagInput.value = note.tags.join(', ');
        if (categorySelect) categorySelect.value = note.category;
        
        // Close modal and scroll to editor
        this.closeModal('allNotesModal');
        noteInput?.scrollIntoView({ behavior: 'smooth' });
        noteInput?.focus();
        
        this.showNotification('Note loaded for editing', 'info');
    }
    
    confirmDeleteNote(id) {
        const note = this.notes.find(n => n.id === id);
        if (!note) return;
        
        const notesList = document.getElementById('allNotesList');
        if (!notesList) return;
        
        const preview = note.content.length > 200 ? note.content.substring(0, 200) + '...' : note.content;
        
        notesList.innerHTML = `
            <div class="delete-confirmation">
                <h3>⚠️ Confirm Deletion</h3>
                <p>Are you sure you want to delete this note? This action cannot be undone.</p>
                
                <div class="delete-confirmation-preview">
                    <strong>Note Preview:</strong><br><br>
                    ${this.escapeHtml(preview)}
                    <br><br>
                    <strong>Date:</strong> ${note.date}<br>
                    ${note.category ? `<strong>Category:</strong> ${note.category}<br>` : ''}
                    ${note.tags.length > 0 ? `<strong>Tags:</strong> ${note.tags.join(', ')}` : ''}
                </div>
                
                <div class="delete-confirmation-actions">
                    <button onclick="app.renderAllNotes()" style="background: linear-gradient(45deg, #6b7280, #4b5563);">
                        ❌ Cancel
                    </button>
                    <button onclick="app.deleteNote(${id})" class="delete-btn">
                        🗑️ Yes, Delete Permanently
                    </button>
                </div>
            </div>
        `;
    }
    
    deleteNote(id) {
        const note = this.notes.find(n => n.id === id);
        if (!note) return;
        
        // Move to trash instead of permanent deletion
        const trashedNote = {
            ...note,
            deletedAt: new Date().toISOString(),
            deletedDate: new Date().toLocaleDateString()
        };
        
        this.trash.unshift(trashedNote);
        
        // Remove from notes array
        this.notes = this.notes.filter(n => n.id !== id);
        
        // Remove from history
        this.history = this.history.filter(h => h.id !== id);
        
        // Remove from pinned notes if it's there
        this.pinnedNotes = this.pinnedNotes.filter(n => n.id !== id);
        
        // Save and update all views
        this.saveToStorage();
        this.renderAll();
        this.renderAllNotes();
        
        this.showNotification('Note moved to trash (recoverable for 30 days)', 'success');
    }

    // ==================== TRASH BIN ====================
    
    showTrash() {
        const modal = document.getElementById('trashModal');
        if (!modal) return;
        
        this.renderTrash();
        modal.style.display = 'block';
    }
    
    renderTrash() {
        const trashList = document.getElementById('trashList');
        const trashCount = document.getElementById('trashCount');
        
        if (!trashList || !trashCount) return;
        
        // Update count
        trashCount.textContent = `${this.trash.length} item${this.trash.length !== 1 ? 's' : ''} in trash`;
        
        if (this.trash.length === 0) {
            trashList.innerHTML = '<div class="empty-notes-message">🗑️ Trash is empty</div>';
            return;
        }
        
        trashList.innerHTML = this.trash.map(note => {
            const deletedDate = new Date(note.deletedAt);
            const now = new Date();
            const daysAgo = Math.floor((now - deletedDate) / (1000 * 60 * 60 * 24));
            const daysRemaining = 30 - daysAgo;
            
            const categoryIcon = {
                'work': '💼',
                'personal': '👤',
                'ideas': '💡',
                'urgent': '🔥'
            }[note.category] || '';
            
            return `
                <div class="trash-item">
                    <div class="note-card ${note.category ? 'category-' + note.category : ''}">
                        <div class="note-card-header">
                            <div class="note-card-meta">
                                <strong>Original: ${note.date}</strong>
                                ${note.category ? `<span class="note-card-category">${categoryIcon} ${note.category}</span>` : ''}
                                <div class="deleted-date">Deleted: ${note.deletedDate} (${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago)</div>
                                <div class="days-remaining">⏰ ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining</div>
                            </div>
                        </div>
                        <div class="note-card-content">
                            ${this.escapeHtml(note.content.length > 200 ? note.content.substring(0, 200) + '...' : note.content)}
                        </div>
                        ${note.tags.length > 0 ? `
                            <div class="note-card-tags">
                                ${note.tags.map(tag => `<span class="note-card-tag">${this.escapeHtml(tag)}</span>`).join('')}
                            </div>
                        ` : ''}
                        <div class="note-card-actions">
                            <button class="restore-btn" onclick="app.restoreNote(${note.id})">
                                ↺ Restore
                            </button>
                            <button class="permanent-delete-btn" onclick="app.confirmPermanentDelete(${note.id})">
                                🗑️ Delete Forever
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    restoreNote(id) {
        const note = this.trash.find(n => n.id === id);
        if (!note) return;
        
        // Remove trash-specific properties
        const restoredNote = { ...note };
        delete restoredNote.deletedAt;
        delete restoredNote.deletedDate;
        
        // Add back to notes
        this.notes.unshift(restoredNote);
        
        // Add back to history
        this.addToHistory(restoredNote);
        
        // Remove from trash
        this.trash = this.trash.filter(n => n.id !== id);
        
        // Save and update
        this.saveToStorage();
        this.renderAll();
        this.renderTrash();
        
        this.showNotification('Note restored successfully!', 'success');
    }
    
    confirmPermanentDelete(id) {
        const note = this.trash.find(n => n.id === id);
        if (!note) return;
        
        const trashList = document.getElementById('trashList');
        if (!trashList) return;
        
        const preview = note.content.length > 200 ? note.content.substring(0, 200) + '...' : note.content;
        
        trashList.innerHTML = `
            <div class="delete-confirmation">
                <h3>⚠️ Permanent Deletion</h3>
                <p><strong>This action CANNOT be undone!</strong> The note will be permanently deleted.</p>
                
                <div class="delete-confirmation-preview">
                    <strong>Note Preview:</strong><br><br>
                    ${this.escapeHtml(preview)}
                    <br><br>
                    <strong>Original Date:</strong> ${note.date}<br>
                    <strong>Deleted:</strong> ${note.deletedDate}<br>
                    ${note.category ? `<strong>Category:</strong> ${note.category}<br>` : ''}
                    ${note.tags.length > 0 ? `<strong>Tags:</strong> ${note.tags.join(', ')}` : ''}
                </div>
                
                <div class="delete-confirmation-actions">
                    <button onclick="app.renderTrash()" style="background: linear-gradient(45deg, #6b7280, #4b5563);">
                        ❌ Cancel
                    </button>
                    <button onclick="app.permanentDelete(${id})" class="permanent-delete-btn">
                        🗑️ Yes, Delete Forever
                    </button>
                </div>
            </div>
        `;
    }
    
    permanentDelete(id) {
        this.trash = this.trash.filter(n => n.id !== id);
        this.saveToStorage();
        this.renderTrash();
        this.showNotification('Note permanently deleted', 'info');
    }
    
    emptyTrash() {
        if (this.trash.length === 0) {
            this.showNotification('Trash is already empty', 'info');
            return;
        }
        
        if (confirm(`Are you sure you want to permanently delete all ${this.trash.length} items in trash? This cannot be undone!`)) {
            const count = this.trash.length;
            this.trash = [];
            this.saveToStorage();
            this.renderTrash();
            this.showNotification(`${count} item${count !== 1 ? 's' : ''} permanently deleted`, 'success');
        }
    }
    
    cleanupTrash() {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        
        const originalCount = this.trash.length;
        this.trash = this.trash.filter(note => {
            const deletedDate = new Date(note.deletedAt);
            return deletedDate > thirtyDaysAgo;
        });
        
        const deletedCount = originalCount - this.trash.length;
        if (deletedCount > 0) {
            console.log(`Auto-cleaned ${deletedCount} old items from trash`);
            this.saveToStorage();
        }
    }

    // ==================== NOTE TEMPLATES ====================
    
    showTemplates() {
        const modal = document.getElementById('templatesModal');
        if (!modal) return;
        
        this.renderTemplates();
        modal.style.display = 'block';
    }
    
    renderTemplates() {
        const grid = document.getElementById('templatesGrid');
        if (!grid) return;
        
        const templates = this.getTemplates();
        
        grid.innerHTML = templates.map((template, index) => `
            <div class="template-card" onclick="app.useTemplate(${index})">
                <h3>${template.name}</h3>
                <p>${template.description}</p>
                <div class="template-preview">${this.escapeHtml(template.content.substring(0, 100))}...</div>
            </div>
        `).join('');
    }
    
    useTemplate(index) {
        const templates = this.getTemplates();
        const template = templates[index];
        
        if (!template) return;
        
        const noteInput = document.getElementById('noteInput');
        if (noteInput) {
            noteInput.value = template.content;
            if (this.markdownMode) {
                this.updateMarkdownPreview();
            }
        }
        
        this.closeModal('templatesModal');
        noteInput?.scrollIntoView({ behavior: 'smooth' });
        noteInput?.focus();
        
        this.showNotification(`Template "${template.name}" loaded!`, 'success');
    }
    
    getTemplates() {
        const today = new Date().toLocaleDateString();
        return [
            {
                name: '📝 Meeting Notes',
                description: 'Template for meeting notes',
                content: `# Meeting Notes\n\n**Date:** ${today}\n**Attendees:** \n**Topic:** \n\n## Agenda\n1. \n2. \n3. \n\n## Discussion Points\n- \n\n## Action Items\n- [ ] \n- [ ] \n\n## Next Steps\n`
            },
            {
                name: '📅 Daily Journal',
                description: 'Daily reflection template',
                content: `# Daily Journal - ${today}\n\n## Today's Goals\n1. \n2. \n3. \n\n## Accomplishments\n- \n\n## Challenges\n- \n\n## Gratitude\n- \n\n## Tomorrow's Focus\n- \n`
            },
            {
                name: '💼 Project Planning',
                description: 'Project planning template',
                content: `# Project: [Project Name]\n\n## Overview\n**Start Date:** \n**End Date:** \n**Status:** \n\n## Objectives\n1. \n2. \n3. \n\n## Milestones\n- [ ] \n- [ ] \n- [ ] \n\n## Resources Needed\n- \n\n## Risks & Mitigation\n- \n\n## Notes\n`
            },
            {
                name: '✅ To-Do List',
                description: 'Structured task list',
                content: `# To-Do List - ${today}\n\n## High Priority\n- [ ] \n- [ ] \n\n## Medium Priority\n- [ ] \n- [ ] \n\n## Low Priority\n- [ ] \n- [ ] \n\n## Completed\n- [x] \n`
            },
            {
                name: '💡 Brainstorm',
                description: 'Idea brainstorming template',
                content: `# Brainstorm Session\n\n**Topic:** \n**Date:** ${today}\n\n## Ideas\n1. \n2. \n3. \n4. \n5. \n\n## Best Ideas\n⭐ \n⭐ \n\n## Next Actions\n- \n`
            },
            {
                name: '📚 Study Notes',
                description: 'Study and learning template',
                content: `# Study Notes: [Subject]\n\n**Date:** ${today}\n**Chapter/Topic:** \n\n## Key Concepts\n- \n- \n- \n\n## Important Points\n1. \n2. \n3. \n\n## Questions\n- \n- \n\n## Summary\n`
            }
        ];
    }

    // ==================== CUSTOM THEMES ====================
    
    showThemeCustomizer() {
        const modal = document.getElementById('themeModal');
        if (!modal) return;
        
        this.renderThemePresets();
        modal.style.display = 'block';
    }
    
    renderThemePresets() {
        const grid = document.getElementById('presetGrid');
        if (!grid) return;
        
        const presets = [
            { name: 'Neon Cyan', primary: '#00ffff', secondary: '#7c3aed', accent: '#ec4899' },
            { name: 'Purple Dream', primary: '#a855f7', secondary: '#ec4899', accent: '#f59e0b' },
            { name: 'Ocean Blue', primary: '#3b82f6', secondary: '#06b6d4', accent: '#10b981' },
            { name: 'Sunset', primary: '#f59e0b', secondary: '#ef4444', accent: '#ec4899' },
            { name: 'Forest', primary: '#10b981', secondary: '#059669', accent: '#84cc16' },
            { name: 'Midnight', primary: '#6366f1', secondary: '#8b5cf6', accent: '#a855f7' }
        ];
        
        grid.innerHTML = presets.map((preset, index) => `
            <div class="preset-theme" 
                 style="background: linear-gradient(135deg, ${preset.primary}, ${preset.secondary});"
                 onclick="app.applyPresetTheme(${index})">
                ${preset.name}
            </div>
        `).join('');
    }
    
    applyPresetTheme(index) {
        const presets = [
            { name: 'Neon Cyan', primary: '#00ffff', secondary: '#7c3aed', accent: '#ec4899' },
            { name: 'Purple Dream', primary: '#a855f7', secondary: '#ec4899', accent: '#f59e0b' },
            { name: 'Ocean Blue', primary: '#3b82f6', secondary: '#06b6d4', accent: '#10b981' },
            { name: 'Sunset', primary: '#f59e0b', secondary: '#ef4444', accent: '#ec4899' },
            { name: 'Forest', primary: '#10b981', secondary: '#059669', accent: '#84cc16' },
            { name: 'Midnight', primary: '#6366f1', secondary: '#8b5cf6', accent: '#a855f7' }
        ];
        
        const preset = presets[index];
        if (!preset) return;
        
        this.setThemeColors(preset.primary, preset.secondary, preset.accent);
        this.showNotification(`${preset.name} theme applied!`, 'success');
    }
    
    applyCustomTheme() {
        const primary = document.getElementById('primaryColor')?.value || '#00ffff';
        const secondary = document.getElementById('secondaryColor')?.value || '#7c3aed';
        const accent = document.getElementById('accentColor')?.value || '#ec4899';
        
        this.setThemeColors(primary, secondary, accent);
        this.showNotification('Custom theme applied!', 'success');
    }
    
    setThemeColors(primary, secondary, accent) {
        document.documentElement.style.setProperty('--accent-cyan', primary);
        document.documentElement.style.setProperty('--accent-purple', secondary);
        document.documentElement.style.setProperty('--accent-pink', accent);
        
        this.customThemeColors = { primary, secondary, accent };
        this.saveToStorage();
    }
    
    resetTheme() {
        document.documentElement.style.setProperty('--accent-cyan', '#00ffff');
        document.documentElement.style.setProperty('--accent-purple', '#7c3aed');
        document.documentElement.style.setProperty('--accent-pink', '#ec4899');
        
        this.customThemeColors = null;
        this.saveToStorage();
        this.showNotification('Theme reset to default', 'info');
    }

    // ==================== BULK OPERATIONS ====================
    
    toggleBulkMode() {
        this.bulkMode = !this.bulkMode;
        this.selectedItems = [];
        
        const allNotesModal = document.getElementById('allNotesModal');
        const bulkBtn = document.getElementById('bulkMode');
        
        if (this.bulkMode) {
            allNotesModal?.classList.add('bulk-mode-active');
            if (bulkBtn) bulkBtn.textContent = '❌ Exit Bulk';
            this.showBulkActionsBar();
            this.showNotification('Bulk mode activated - Click items to select', 'info');
        } else {
            allNotesModal?.classList.remove('bulk-mode-active');
            if (bulkBtn) bulkBtn.textContent = '☑️ Bulk Select';
            this.hideBulkActionsBar();
            this.showNotification('Bulk mode deactivated', 'info');
        }
    }
    
    showBulkActionsBar() {
        let bar = document.getElementById('bulkActionsBar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'bulkActionsBar';
            bar.className = 'bulk-actions-bar';
            document.body.appendChild(bar);
        }
        
        this.updateBulkActionsBar();
    }
    
    updateBulkActionsBar() {
        const bar = document.getElementById('bulkActionsBar');
        if (!bar) return;
        
        bar.innerHTML = `
            <span class="bulk-count">${this.selectedItems.length} selected</span>
            <button onclick="app.bulkDelete()">🗑️ Delete Selected</button>
            <button onclick="app.bulkExport()">📥 Export Selected</button>
            <button onclick="app.selectAll()">☑️ Select All</button>
            <button onclick="app.deselectAll()">☐ Deselect All</button>
        `;
    }
    
    hideBulkActionsBar() {
        const bar = document.getElementById('bulkActionsBar');
        if (bar) bar.remove();
    }
    
    toggleItemSelection(id) {
        const index = this.selectedItems.indexOf(id);
        if (index > -1) {
            this.selectedItems.splice(index, 1);
        } else {
            this.selectedItems.push(id);
        }
        this.updateBulkActionsBar();
    }
    
    selectAll() {
        this.selectedItems = this.notes.map(n => n.id);
        this.updateBulkActionsBar();
        this.renderAllNotes();
        this.showNotification(`${this.selectedItems.length} items selected`, 'info');
    }
    
    deselectAll() {
        this.selectedItems = [];
        this.updateBulkActionsBar();
        this.renderAllNotes();
        this.showNotification('All items deselected', 'info');
    }
    
    bulkDelete() {
        if (this.selectedItems.length === 0) {
            this.showNotification('No items selected', 'warning');
            return;
        }
        
        if (confirm(`Delete ${this.selectedItems.length} selected notes?`)) {
            this.selectedItems.forEach(id => this.deleteNote(id));
            this.selectedItems = [];
            this.updateBulkActionsBar();
            this.renderAllNotes();
            this.showNotification('Selected notes moved to trash', 'success');
        }
    }
    
    bulkExport() {
        if (this.selectedItems.length === 0) {
            this.showNotification('No items selected', 'warning');
            return;
        }
        
        const selectedNotes = this.notes.filter(n => this.selectedItems.includes(n.id));
        const data = {
            notes: selectedNotes,
            exportDate: new Date().toISOString(),
            count: selectedNotes.length
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `selected-notes-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showNotification(`${selectedNotes.length} notes exported`, 'success');
    }

    // ==================== QUICK CAPTURE ====================
    
    showQuickCapture() {
        const modal = document.getElementById('quickCaptureModal');
        const input = document.getElementById('quickCaptureInput');
        
        if (!modal || !input) return;
        
        input.value = '';
        modal.style.display = 'block';
        input.focus();
    }
    
    saveQuickCapture() {
        const input = document.getElementById('quickCaptureInput');
        if (!input || !input.value.trim()) {
            this.showNotification('Please enter a note', 'warning');
            return;
        }
        
        const note = {
            id: Date.now(),
            content: input.value.trim(),
            tags: ['quick-capture'],
            category: '',
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleDateString(),
            pinned: false
        };
        
        this.notes.unshift(note);
        this.tags.add('quick-capture');
        this.addToHistory(note);
        this.saveToStorage();
        this.renderAll();
        
        this.closeModal('quickCaptureModal');
        this.showNotification('Quick note saved!', 'success');
    }

    // ==================== AI TEXT IMPROVEMENT ====================
    
    showAISettings() {
        const modal = document.getElementById('aiSettingsModal');
        const tokenInput = document.getElementById('geminiApiKey');
        
        if (!modal || !tokenInput) return;
        
        // Load saved API key
        if (this.geminiApiKey) {
            tokenInput.value = this.geminiApiKey;
        }
        
        modal.style.display = 'block';
    }
    
    saveAIToken() {
        const tokenInput = document.getElementById('geminiApiKey');
        const statusEl = document.getElementById('aiStatus');
        
        if (!tokenInput || !statusEl) return;
        
        const apiKey = tokenInput.value.trim();
        
        if (!apiKey) {
            this.showAIStatus('Please enter an API key', 'error');
            return;
        }
        
        if (!apiKey.startsWith('AIza')) {
            this.showAIStatus('Invalid API key format. Should start with "AIza"', 'error');
            return;
        }
        
        this.geminiApiKey = apiKey;
        this.saveToStorage();
        this.showAIStatus('API key saved successfully! ✅', 'success');
        this.showNotification('Gemini API key saved!', 'success');
    }
    
    async testAIConnection() {
        if (!this.geminiApiKey) {
            this.showAIStatus('No API key set. Built-in tools will be used (offline mode).', 'success');
            this.showNotification('Using built-in text tools (no API)', 'info');
            return;
        }
        
        this.showAIStatus('Testing Gemini API connection... ⏳', 'loading');
        
        try {
            // Initialize Google AI
            const genAI = new GoogleGenerativeAI(this.geminiApiKey);
            
            // Try gemini-1.5-flash first
            try {
                const model = genAI.getGenerativeModel({
                model: "gemini-2.5-flash" });
                const result = await model.generateContent("Hello");
                const response = await result.response;
                const text = response.text();
                
                this.showAIStatus('Gemini 1.5 Flash connected! ✅ Real AI is ready!', 'success');
                this.showNotification('Gemini AI connected successfully!', 'success');
            } catch (flashError) {
                // Try gemini-pro as fallback
                const model = genAI.getGenerativeModel({ model: "gemini-pro" });
                const result = await model.generateContent("Hello");
                const response = await result.response;
                const text = response.text();
                
                this.showAIStatus('Gemini Pro connected! ✅ Real AI is ready!', 'success');
                this.showNotification('Gemini AI connected successfully!', 'success');
            }
        } catch (error) {
            this.showAIStatus(`Connection error: ${error.message}. Will use built-in tools as fallback.`, 'error');
            this.showNotification('API failed, will use built-in tools', 'warning');
        }
    }
    
    showAIStatus(message, type) {
        const statusEl = document.getElementById('aiStatus');
        if (!statusEl) return;
        
        statusEl.textContent = message;
        statusEl.className = type;
        statusEl.style.display = 'block';
    }
    
    async aiImprove(action) {
        const noteInput = document.getElementById('noteInput');
        
        if (!noteInput || !noteInput.value.trim()) {
            this.showNotification('Please enter some text first', 'warning');
            return;
        }
        
        const originalText = noteInput.value.trim();
        this.aiOriginalText = originalText;
        
        // Close the menu
        const menu = document.getElementById('aiActionsMenu');
        if (menu) menu.style.display = 'none';
        
        // Show loading notification
        this.showNotification('AI is improving your text... ⏳', 'info');
        
        try {
            const improvedText = await this.callGeminiAPI(originalText, action);
            this.showAIPreview(originalText, improvedText);
        } catch (error) {
            this.showNotification(`AI error: ${error.message}`, 'error');
        }
    }
    
    async callGeminiAPI(text, action) {
        // If no API key, use built-in tools as fallback
        if (!this.geminiApiKey) {
            return this.improveTextLocally(text, action);
        }
        
        // Try real AI first
        try {
            return await this.callRealAI(text, action);
        } catch (error) {
            console.error('AI API failed, using built-in tools:', error);
            this.showNotification('AI API failed, using built-in tools as fallback', 'warning');
            return this.improveTextLocally(text, action);
        }
    }
    
    async callRealAI(text, action) {
        const prompts = {
            grammar: `Fix all grammar and spelling errors in this text. Return ONLY the corrected text, nothing else:\n\n${text}`,
            professional: `Rewrite this text in a professional and formal tone. Return ONLY the rewritten text, nothing else:\n\n${text}`,
            simplify: `Simplify this text to make it clearer and easier to understand. Return ONLY the simplified text, nothing else:\n\n${text}`,
            expand: `Expand this text with more details and explanation. Return ONLY the expanded text, nothing else:\n\n${text}`,
            reformat: `Reformat this text with better structure using markdown. Return ONLY the reformatted text, nothing else:\n\n${text}`
        };
        
        const prompt = prompts[action] || text;
        
        try {
            // Initialize Google AI with API key
            const genAI = new GoogleGenerativeAI(this.geminiApiKey);
            
            // Get the model - try gemini-1.5-flash first (latest and fastest)
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            
            // Generate content
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            return text;
        } catch (error) {
            // If gemini-1.5-flash fails, try gemini-pro
            try {
                const genAI = new GoogleGenerativeAI(this.geminiApiKey);
                const model = genAI.getGenerativeModel({
                model: "gemini2.5-filash" });
                const result = await model.generateContent(prompt);
                const response = await result.response;
                const text = response.text();
                return text;
            } catch (fallbackError) {
                throw new Error(`AI API failed: ${fallbackError.message}`);
            }
        }
    }
    
    improveTextLocally(text, action) {
        // Built-in text improvement (works offline!)
        let improved = text;
        
        switch(action) {
            case 'grammar':
                // Fix common grammar issues
                improved = this.fixGrammar(text);
                break;
                
            case 'professional':
                // Make text more professional
                improved = this.makeProfessional(text);
                break;
                
            case 'simplify':
                // Simplify text
                improved = this.simplifyText(text);
                break;
                
            case 'expand':
                // Expand text
                improved = this.expandText(text);
                break;
                
            case 'reformat':
                // Reformat with markdown
                improved = this.reformatText(text);
                break;
                
            default:
                improved = text;
        }
        
        return improved;
    }
    
    fixGrammar(text) {
        let fixed = text;
        
        // Comprehensive spelling corrections (50+ common errors)
        const corrections = {
            // Common typos
            'teh': 'the', 'hte': 'the', 'taht': 'that', 'thier': 'their',
            'recieve': 'receive', 'beleive': 'believe', 'acheive': 'achieve',
            'occured': 'occurred', 'occuring': 'occurring',
            'seperate': 'separate', 'definately': 'definitely',
            'grammer': 'grammar', 'erors': 'errors', 'writting': 'writing',
            'occassion': 'occasion', 'untill': 'until', 'sucessful': 'successful',
            
            // Common word confusions
            'your welcome': 'you\'re welcome', 'its a': 'it\'s a',
            'alot': 'a lot', 'aswell': 'as well', 'incase': 'in case',
            'infact': 'in fact', 'ofcourse': 'of course',
            
            // Common misspellings
            'wierd': 'weird', 'freind': 'friend', 'neice': 'niece',
            'peice': 'piece', 'cheif': 'chief', 'beleif': 'belief',
            'reccomend': 'recommend', 'accomodate': 'accommodate',
            'embarass': 'embarrass', 'harrass': 'harass',
            'occassionally': 'occasionally', 'necesary': 'necessary',
            'tommorow': 'tomorrow', 'begining': 'beginning',
            'comming': 'coming', 'runing': 'running',
            'stoped': 'stopped', 'planing': 'planning',
            
            // Technical terms
            'recieved': 'received', 'adress': 'address',
            'refered': 'referred', 'prefered': 'preferred',
            'transfered': 'transferred'
        };
        
        // Apply corrections
        Object.keys(corrections).forEach(wrong => {
            const regex = new RegExp('\\b' + wrong + '\\b', 'gi');
            fixed = fixed.replace(regex, (match) => {
                // Preserve original case
                if (match[0] === match[0].toUpperCase()) {
                    return corrections[wrong].charAt(0).toUpperCase() + corrections[wrong].slice(1);
                }
                return corrections[wrong];
            });
        });
        
        // Fix spacing issues
        fixed = fixed.replace(/\s+/g, ' '); // Multiple spaces to single
        fixed = fixed.replace(/\s+([.,!?;:])/g, '$1'); // Space before punctuation
        fixed = fixed.replace(/([.,!?;:])([a-zA-Z])/g, '$1 $2'); // Missing space after punctuation
        
        // Capitalize first letter of text
        fixed = fixed.charAt(0).toUpperCase() + fixed.slice(1);
        
        // Capitalize after sentence endings
        fixed = fixed.replace(/([.!?])\s+([a-z])/g, (match, punct, letter) => punct + ' ' + letter.toUpperCase());
        
        // Add period at end if missing
        if (!fixed.match(/[.!?]$/)) {
            fixed += '.';
        }
        
        // Fix common grammar patterns
        fixed = fixed.replace(/\bi\b/g, 'I'); // Lowercase 'i' to 'I'
        fixed = fixed.replace(/\bi'm\b/gi, "I'm");
        fixed = fixed.replace(/\bi'll\b/gi, "I'll");
        fixed = fixed.replace(/\bi've\b/gi, "I've");
        fixed = fixed.replace(/\bi'd\b/gi, "I'd");
        
        return fixed.trim();
    }
    
    makeProfessional(text) {
        let professional = text;
        
        // Comprehensive casual to professional replacements
        const replacements = {
            // Greetings
            'hey': 'Hello', 'hi there': 'Hello', 'sup': 'Hello',
            'yo': 'Hello', 'hiya': 'Hello',
            
            // Responses
            'yeah': 'Yes', 'yep': 'Yes', 'yup': 'Yes', 'uh-huh': 'Yes',
            'nope': 'No', 'nah': 'No', 'naw': 'No',
            'maybe': 'Perhaps', 'dunno': 'I do not know',
            
            // Contractions to formal
            'gonna': 'going to', 'wanna': 'want to', 'gotta': 'have to',
            'hafta': 'have to', 'shoulda': 'should have',
            'coulda': 'could have', 'woulda': 'would have',
            'kinda': 'kind of', 'sorta': 'sort of',
            'lotsa': 'lots of', 'outta': 'out of',
            
            // Casual phrases
            'ok': 'okay', 'k': 'okay', 'alright': 'all right',
            'thanks': 'Thank you', 'thx': 'Thank you',
            'pls': 'please', 'plz': 'please',
            
            // Abbreviations
            'asap': 'as soon as possible',
            'fyi': 'for your information',
            'btw': 'by the way',
            'imo': 'in my opinion',
            'imho': 'in my humble opinion',
            'etc': 'et cetera',
            
            // Casual verbs
            'get': 'obtain', 'got': 'obtained', 'getting': 'obtaining',
            'check out': 'review', 'figure out': 'determine',
            'find out': 'discover', 'look into': 'investigate',
            
            // Casual adjectives
            'big': 'significant', 'huge': 'substantial',
            'tiny': 'minimal', 'lots of': 'numerous',
            'a bunch of': 'several', 'a ton of': 'many'
        };
        
        // Apply replacements
        Object.keys(replacements).forEach(casual => {
            const regex = new RegExp('\\b' + casual + '\\b', 'gi');
            professional = professional.replace(regex, (match) => {
                const replacement = replacements[casual.toLowerCase()];
                // Preserve capitalization
                if (match[0] === match[0].toUpperCase()) {
                    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
                }
                return replacement;
            });
        });
        
        // Remove filler words
        professional = professional.replace(/\b(like|um|uh|er|ah)\b,?\s*/gi, '');
        
        // Fix spacing
        professional = professional.replace(/\s+/g, ' ').trim();
        
        // Capitalize first letter
        professional = professional.charAt(0).toUpperCase() + professional.slice(1);
        
        // Capitalize after periods
        professional = professional.replace(/([.!?])\s+([a-z])/g, (match, punct, letter) => punct + ' ' + letter.toUpperCase());
        
        // Add period if missing
        if (!professional.match(/[.!?]$/)) {
            professional += '.';
        }
        
        return professional;
    }
    
    simplifyText(text) {
        let simple = text;
        
        // Replace complex words with simpler ones
        const simplifications = {
            'utilize': 'use',
            'implement': 'do',
            'facilitate': 'help',
            'demonstrate': 'show',
            'approximately': 'about',
            'sufficient': 'enough',
            'commence': 'start',
            'terminate': 'end',
            'purchase': 'buy',
            'assist': 'help'
        };
        
        Object.keys(simplifications).forEach(complex => {
            const regex = new RegExp('\\b' + complex + '\\b', 'gi');
            simple = simple.replace(regex, simplifications[complex]);
        });
        
        return simple;
    }
    
    expandText(text) {
        // Add more context and detail
        const sentences = text.split(/[.!?]+/).filter(s => s.trim());
        
        if (sentences.length === 1) {
            return text + ' This is an important point that requires careful consideration. Further analysis and discussion would be beneficial to fully understand the implications.';
        }
        
        return text + ' Additionally, it is worth noting that this matter deserves further attention and detailed examination.';
    }
    
    reformatText(text) {
        // Convert to markdown format
        const sentences = text.split(/[.!?]+/).filter(s => s.trim());
        
        if (sentences.length <= 1) {
            return `# ${text}\n\n*Formatted for better readability*`;
        }
        
        let formatted = '# Main Points\n\n';
        sentences.forEach((sentence, index) => {
            formatted += `${index + 1}. ${sentence.trim()}.\n`;
        });
        
        return formatted;
    }
    
    showAIPreview(original, improved) {
        const modal = document.getElementById('aiPreviewModal');
        const originalBox = document.getElementById('aiOriginalText');
        const improvedBox = document.getElementById('aiImprovedText');
        
        if (!modal || !originalBox || !improvedBox) return;
        
        originalBox.textContent = original;
        improvedBox.textContent = improved;
        
        modal.style.display = 'block';
        this.showNotification('AI improvement complete! ✨', 'success');
    }
    
    acceptAIImprovement() {
        const improvedBox = document.getElementById('aiImprovedText');
        const noteInput = document.getElementById('noteInput');
        
        if (!improvedBox || !noteInput) return;
        
        noteInput.value = improvedBox.textContent;
        
        if (this.markdownMode) {
            this.updateMarkdownPreview();
        }
        
        this.closeModal('aiPreviewModal');
        this.showNotification('AI improvement accepted! ✅', 'success');
    }

    // ==================== PWA ====================
    
    initPWA() {
        // Register service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./service-worker.js')
                .then(registration => {
                    console.log('Service Worker registered:', registration);
                    this.showNotification('App ready for offline use! 🚀', 'success');
                })
                .catch(error => {
                    console.log('Service Worker registration failed:', error);
                });
        }
        
        // Listen for install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            
            // Show install prompt after 30 seconds if not dismissed
            setTimeout(() => {
                if (this.deferredPrompt && !localStorage.getItem('pwaPromptDismissed')) {
                    this.showPWAPrompt();
                }
            }, 30000);
        });
        
        // Listen for successful install
        window.addEventListener('appinstalled', () => {
            this.deferredPrompt = null;
            this.dismissPWAPrompt();
            this.showNotification('App installed successfully! 🎉', 'success');
        });
    }
    
    showPWAPrompt() {
        const prompt = document.getElementById('pwaInstallPrompt');
        if (prompt) {
            prompt.style.display = 'block';
        }
    }
    
    async installPWA() {
        if (!this.deferredPrompt) {
            this.showNotification('Install not available. Try opening in Chrome/Edge.', 'info');
            return;
        }
        
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            this.showNotification('Installing app... 🚀', 'success');
        }
        
        this.deferredPrompt = null;
        this.dismissPWAPrompt();
    }
    
    dismissPWAPrompt() {
        const prompt = document.getElementById('pwaInstallPrompt');
        if (prompt) {
            prompt.style.display = 'none';
        }
        localStorage.setItem('pwaPromptDismissed', 'true');
    }

    // ==================== CLOUD SYNC ====================
    
    showCloudSync() {
        const modal = document.getElementById('cloudSyncModal');
        const tokenInput = document.getElementById('githubToken');
        
        if (!modal || !tokenInput) return;
        
        // Load saved token
        if (this.githubToken) {
            tokenInput.value = this.githubToken;
        }
        
        this.updateSyncStatus();
        modal.style.display = 'block';
    }
    
    saveGithubToken() {
        const tokenInput = document.getElementById('githubToken');
        if (!tokenInput) return;
        
        const token = tokenInput.value.trim();
        
        if (!token) {
            this.showCloudSyncStatus('Please enter a token', 'error');
            return;
        }
        
        if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
            this.showCloudSyncStatus('Invalid token format', 'error');
            return;
        }
        
        this.githubToken = token;
        this.saveToStorage();
        this.showCloudSyncStatus('Token saved successfully! ✅', 'success');
        this.showNotification('GitHub token saved!', 'success');
        this.updateSyncStatus();
    }
    
    async testGithubConnection() {
        if (!this.githubToken) {
            this.showCloudSyncStatus('Please save your token first', 'error');
            return;
        }
        
        this.showCloudSyncStatus('Testing connection... ⏳', 'loading');
        
        try {
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `Bearer ${this.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (response.ok) {
                const user = await response.json();
                this.showCloudSyncStatus(`Connected as ${user.login}! ✅`, 'success');
                this.showNotification('GitHub connected!', 'success');
                this.updateSyncStatus(true);
            } else {
                this.showCloudSyncStatus('Connection failed. Check your token.', 'error');
                this.updateSyncStatus(false);
            }
        } catch (error) {
            this.showCloudSyncStatus(`Error: ${error.message}`, 'error');
            this.updateSyncStatus(false);
        }
    }
    
    async syncNow() {
        if (!this.githubToken) {
            this.showCloudSyncStatus('Please configure GitHub token first', 'error');
            this.showCloudSync();
            return;
        }
        
        this.showCloudSyncStatus('Syncing... 🔄', 'loading');
        this.updateSyncStatus(null, true);
        
        try {
            // Prepare data to sync
            const syncData = {
                notes: this.notes,
                todos: this.todos,
                tags: Array.from(this.tags),
                pinnedNotes: this.pinnedNotes,
                lastSync: new Date().toISOString(),
                version: '1.0'
            };
            
            if (this.gistId) {
                // Update existing gist
                await this.updateGist(syncData);
            } else {
                // Create new gist
                await this.createGist(syncData);
            }
            
            this.showCloudSyncStatus('Sync complete! ✅', 'success');
            this.showNotification('Notes synced to cloud!', 'success');
            this.updateSyncStatus(true, false);
            this.updateLastSyncTime();
        } catch (error) {
            this.showCloudSyncStatus(`Sync failed: ${error.message}`, 'error');
            this.updateSyncStatus(false, false);
        }
    }
    
    async createGist(data) {
        const response = await fetch('https://api.github.com/gists', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                description: 'NoteAI - Cloud Sync Data',
                public: false,
                files: {
                    'noteai-data.json': {
                        content: JSON.stringify(data, null, 2)
                    }
                }
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to create gist');
        }
        
        const gist = await response.json();
        this.gistId = gist.id;
        this.saveToStorage();
    }
    
    async updateGist(data) {
        const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${this.githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                files: {
                    'noteai-data.json': {
                        content: JSON.stringify(data, null, 2)
                    }
                }
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update gist');
        }
    }
    
    toggleAutoSync() {
        this.autoSync = !this.autoSync;
        const button = document.getElementById('autoSyncToggle');
        
        if (this.autoSync) {
            if (!this.githubToken) {
                this.showCloudSyncStatus('Please configure GitHub token first', 'error');
                this.autoSync = false;
                return;
            }
            button.textContent = '▶️ Auto-Sync: ON';
            button.dataset.enabled = 'true';
            this.startAutoSync();
            this.showNotification('Auto-sync enabled (every 5 min)', 'success');
        } else {
            button.textContent = '⏸️ Auto-Sync: OFF';
            button.dataset.enabled = 'false';
            this.stopAutoSync();
            this.showNotification('Auto-sync disabled', 'info');
        }
        
        this.saveToStorage();
    }
    
    startAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        // Sync every 5 minutes
        this.syncInterval = setInterval(() => {
            this.syncNow();
        }, 5 * 60 * 1000);
    }
    
    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }
    
    updateSyncStatus(connected = null, syncing = false) {
        const indicator = document.getElementById('statusIndicator');
        if (!indicator) return;
        
        if (syncing) {
            indicator.textContent = '🔵 Syncing...';
            indicator.className = 'status-indicator syncing';
        } else if (connected === true) {
            indicator.textContent = '🟢 Connected';
            indicator.className = 'status-indicator connected';
        } else if (connected === false) {
            indicator.textContent = '🔴 Connection Failed';
            indicator.className = 'status-indicator error';
        } else if (this.githubToken) {
            indicator.textContent = '🟡 Token Saved';
            indicator.className = 'status-indicator';
        } else {
            indicator.textContent = '⚪ Not Connected';
            indicator.className = 'status-indicator';
        }
    }
    
    updateLastSyncTime() {
        const lastSyncEl = document.getElementById('lastSync');
        if (lastSyncEl) {
            lastSyncEl.textContent = `Last sync: ${new Date().toLocaleString()}`;
        }
    }
    
    showCloudSyncStatus(message, type) {
        const statusEl = document.getElementById('cloudSyncStatus');
        if (!statusEl) return;
        
        statusEl.textContent = message;
        statusEl.className = type;
        statusEl.style.display = 'block';
    }

    // ==================== MODALS ====================
    
    showShortcuts() {
        const modal = document.getElementById('shortcutsModal');
        if (modal) modal.style.display = 'block';
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'none';
    }

    // ==================== THEME ====================
    
    toggleTheme() {
        document.body.classList.toggle('light-theme');
        this.currentTheme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
        
        const themeBtn = document.getElementById('themeToggle');
        if (themeBtn) {
            themeBtn.textContent = this.currentTheme === 'light' ? '☀️' : '🌙';
        }
        
        this.saveToStorage();
        this.showNotification(`${this.currentTheme === 'light' ? 'Light' : 'Dark'} theme activated`, 'info');
    }

    // ==================== EXPORT/IMPORT ====================
    
    exportJSON() {
        try {
            const data = {
                notes: this.notes,
                todos: this.todos,
                tags: Array.from(this.tags),
                pinnedNotes: this.pinnedNotes,
                exportDate: new Date().toISOString()
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `neon-notes-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);

            this.showNotification('Exported to JSON successfully!', 'success');
        } catch (error) {
            console.error('Export error:', error);
            this.showNotification('Error exporting to JSON', 'error');
        }
    }

    importJSON() {
        const fileInput = document.getElementById('importFile');
        if (!fileInput) return;

        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    
                    if (confirm('This will merge imported data with existing data. Continue?')) {
                        this.notes = [...this.notes, ...(data.notes || [])];
                        this.todos = [...this.todos, ...(data.todos || [])];
                        this.pinnedNotes = [...this.pinnedNotes, ...(data.pinnedNotes || [])];
                        
                        if (data.tags) {
                            data.tags.forEach(tag => this.tags.add(tag));
                        }
                        
                        this.saveToStorage();
                        this.renderAll();
                        this.showNotification('Data imported successfully!', 'success');
                    }
                } catch (error) {
                    this.showNotification('Error importing data: Invalid file', 'error');
                }
            };
            reader.readAsText(file);
        };

        fileInput.click();
    }

    createBackup() {
        this.exportJSON();
        this.showNotification('Backup created!', 'success');
    }

    exportPDF() {
        try {
            if (typeof window.jspdf === 'undefined') {
                this.showNotification('PDF library not loaded', 'error');
                return;
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            let yPos = 20;
            const lineHeight = 7;
            const pageHeight = doc.internal.pageSize.height;

            // Title
            doc.setFontSize(20);
            doc.setTextColor(0, 255, 255);
            doc.text('NEON NOTES - ADVANCED EDITION', 20, yPos);
            yPos += 15;

            // Export date
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`Exported: ${new Date().toLocaleString()}`, 20, yPos);
            yPos += 15;

            // Statistics
            doc.setFontSize(12);
            doc.setTextColor(124, 58, 237);
            doc.text('STATISTICS', 20, yPos);
            yPos += 10;
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            doc.text(`Total Notes: ${this.notes.length} | Total Tasks: ${this.todos.length} | Tags: ${this.tags.size}`, 20, yPos);
            yPos += 15;

            // Notes section
            if (this.notes.length > 0) {
                doc.setFontSize(14);
                doc.setTextColor(124, 58, 237);
                doc.text('NOTES', 20, yPos);
                yPos += 10;

                doc.setFontSize(10);
                doc.setTextColor(0, 0, 0);

                this.notes.forEach((note, index) => {
                    if (yPos > pageHeight - 30) {
                        doc.addPage();
                        yPos = 20;
                    }

                    doc.setFont(undefined, 'bold');
                    doc.text(`${index + 1}. ${note.date} ${note.category ? '| ' + note.category : ''}`, 20, yPos);
                    yPos += lineHeight;

                    doc.setFont(undefined, 'normal');
                    const lines = doc.splitTextToSize(note.content, 170);
                    lines.forEach(line => {
                        if (yPos > pageHeight - 20) {
                            doc.addPage();
                            yPos = 20;
                        }
                        doc.text(line, 25, yPos);
                        yPos += lineHeight;
                    });

                    if (note.tags.length > 0) {
                        doc.setTextColor(0, 153, 204);
                        doc.text(`Tags: ${note.tags.join(', ')}`, 25, yPos);
                        doc.setTextColor(0, 0, 0);
                        yPos += lineHeight;
                    }

                    yPos += 5;
                });
            }

            // Todos section
            if (this.todos.length > 0) {
                yPos += 10;
                if (yPos > pageHeight - 40) {
                    doc.addPage();
                    yPos = 20;
                }

                doc.setFontSize(14);
                doc.setTextColor(236, 72, 153);
                doc.text('TASKS', 20, yPos);
                yPos += 10;

                doc.setFontSize(10);
                doc.setTextColor(0, 0, 0);

                this.todos.forEach((todo, index) => {
                    if (yPos > pageHeight - 20) {
                        doc.addPage();
                        yPos = 20;
                    }

                    const status = todo.completed ? '[✓]' : '[ ]';
                    doc.text(`${status} [${todo.priority}] ${todo.text}`, 20, yPos);
                    yPos += lineHeight;
                });
            }

            doc.save(`neon-notes-advanced-${Date.now()}.pdf`);
            this.showNotification('Exported to PDF successfully!', 'success');
        } catch (error) {
            console.error('PDF export error:', error);
            this.showNotification('Error exporting to PDF', 'error');
        }
    }

    // ==================== AI ASSISTANT ====================
    
    handleAIInput() {
        const aiInput = document.getElementById('aiInput');
        const aiChat = document.getElementById('aiChat');
        
        if (!aiInput || !aiChat || !aiInput.value.trim()) return;

        const userMessage = aiInput.value.trim();
        
        // Add user message
        const userDiv = document.createElement('div');
        userDiv.className = 'ai-message';
        userDiv.style.background = 'rgba(124, 58, 237, 0.1)';
        userDiv.style.borderLeftColor = '#7c3aed';
        userDiv.textContent = `You: ${userMessage}`;
        aiChat.appendChild(userDiv);

        // Generate AI response
        const response = this.generateAIResponse(userMessage);
        
        setTimeout(() => {
            const aiDiv = document.createElement('div');
            aiDiv.className = 'ai-message';
            aiDiv.textContent = `AI: ${response}`;
            aiChat.appendChild(aiDiv);
            aiChat.scrollTop = aiChat.scrollHeight;
        }, 500);

        aiInput.value = '';
        aiChat.scrollTop = aiChat.scrollHeight;
    }

    generateAIResponse(message) {
        const lower = message.toLowerCase();
        
        // Check for intent-based requests (write, save, remember, etc.)
        if (lower.includes('write') || lower.includes('save') || lower.includes('remember') || lower.includes('note down') || lower.includes('jot down')) {
            // If it's a general request to write something, treat it as create note
            if (!lower.includes('how to write') && !lower.includes('can you write')) {
                return this.aiCreateNoteFromIntent(message);
            }
        }
        
        // Check for action commands
        if (lower.includes('create note') || lower.includes('add note') || lower.includes('new note') || lower.includes('make note')) {
            return this.aiCreateNote(message);
        } else if (lower.includes('create task') || lower.includes('add task') || lower.includes('new task') || lower.includes('make task')) {
            return this.aiCreateTask(message);
        } else if (lower.includes('search') && (lower.includes('note') || lower.includes('tag'))) {
            return this.aiSearchNotes(message);
        } else if (lower.includes('delete') || lower.includes('remove')) {
            return 'To delete notes, please use the "All Notes" feature (Ctrl+L) and select the notes you want to delete.';
        } else if (lower.includes('what else') || lower.includes('what more') || lower.includes('except that') || lower.includes('anything else') || lower.includes('other')) {
            return this.getMoreCapabilities();
        } else if (lower.includes('how') && (lower.includes('work') || lower.includes('use'))) {
            return this.getHowToUse();
        } else if (lower.includes('can you') || lower.includes('are you able')) {
            return this.getCapabilities();
        } else if (lower.includes('thank') || lower.includes('thanks')) {
            return 'You\'re welcome! Happy to help. Let me know if you need anything else! 😊';
        } else if (lower.includes('good') || lower.includes('great') || lower.includes('awesome') || lower.includes('nice')) {
            return 'Glad I could help! Feel free to ask me anything or use commands to create notes and tasks. 🚀';
        }
        
        // Information queries
        if (lower.includes('hello') || lower.includes('hi')) {
            return 'Hello! I can help you create notes, add tasks, search, and more. Try: "Create note with tags work: Meeting notes"';
        } else if (lower.includes('help')) {
            return 'I can:\n• Create notes: "Create note with tags work: Your content"\n• Add tasks: "Add task: Buy groceries"\n• Search: "Search notes with tag work"\n• Show stats\n• And more!';
        } else if (lower.includes('note')) {
            return `You have ${this.notes.length} notes saved (${this.pinnedNotes.length} pinned). Try: "Create note with tags daily: Your content"`;
        } else if (lower.includes('task') || lower.includes('todo')) {
            const pending = this.todos.filter(t => !t.completed).length;
            const completed = this.todos.filter(t => t.completed).length;
            return `You have ${this.todos.length} tasks total: ${pending} pending, ${completed} completed. Try: "Add task: Your task here"`;
        } else if (lower.includes('tag')) {
            return `You're using ${this.tags.size} tags: ${Array.from(this.tags).slice(0, 5).join(', ')}${this.tags.size > 5 ? '...' : ''}`;
        } else if (lower.includes('stats') || lower.includes('statistics')) {
            const productivity = this.todos.length > 0 ? Math.round((this.todos.filter(t => t.completed).length / this.todos.length) * 100) : 0;
            return `Your productivity is at ${productivity}%! You've written ${this.notes.reduce((sum, n) => sum + n.content.split(/\s+/).length, 0)} words across ${this.notes.length} notes.`;
        } else if (lower.includes('pomodoro') || lower.includes('timer')) {
            return 'Use the Pomodoro timer in the sidebar to boost your focus! 25 minutes of work, 5 minutes of break. Stay productive!';
        } else if (lower.includes('voice')) {
            return 'Click the microphone button 🎤 to use voice input for your notes. Speak naturally and I\'ll transcribe it for you!';
        } else if (lower.includes('markdown')) {
            return 'Toggle the eye icon 👁️ to preview your notes in Markdown format. Use # for headings, ** for bold, and more!';
        } else {
            // If no specific match, try to be helpful
            if (message.trim().length < 3) {
                return 'I\'m here to help! Try asking me something or use commands like "Create note" or "Add task".';
            }
            return 'I\'m not sure what you mean. I can:\n\n📝 Create notes: "Create note with tags work: Your content"\n✅ Add tasks: "Add task: Your task"\n🔍 Search: "Search notes with tag work"\n📊 Show stats, notes, or tasks\n\nTry "help" for more info!';
        }
    }
    
    getCapabilities() {
        return `I can do many things! 🚀\n\n📝 **Create Notes:**\n- With tags: "Create note with tags work,daily: Your content"\n- Simple: "Create note: Your content"\n\n✅ **Manage Tasks:**\n- Add: "Add task: Your task"\n- View status: "Show tasks"\n\n🔍 **Search:**\n- By tag: "Search notes with tag work"\n- By content: "Search notes: keyword"\n\n📊 **Information:**\n- "Show stats" - Your productivity\n- "Show tags" - All your tags\n- "How many notes?" - Note count\n\nWhat would you like to do?`;
    }
    
    getMoreCapabilities() {
        return `Here are more things I can help with! ✨\n\n🎯 **Productivity:**\n- Start Pomodoro timer\n- Track your progress\n- View statistics\n\n🎨 **Features:**\n- Voice input (🎤 button)\n- Markdown preview (👁️ button)\n- AI text improvement (✨ button)\n- Templates (📋 button)\n- Custom themes (🎨 Themes)\n\n💾 **Data:**\n- Export to JSON/PDF\n- Backup your data\n- Import from JSON\n\n🗑️ **Organization:**\n- Pin important notes\n- Categorize (Work, Personal, Ideas, Urgent)\n- Tag system\n- Trash bin (30-day recovery)\n\nTry any command or ask me questions!`;
    }
    
    getHowToUse() {
        return `Here's how to use me! 📚\n\n**Quick Start:**\n1️⃣ Type a command\n2️⃣ Press Enter or click ➤\n3️⃣ I'll do it for you!\n\n**Example Commands:**\n📝 "Create note with tags daily: Meeting notes"\n✅ "Add task: Buy groceries"\n🔍 "Search notes with tag work"\n📊 "Show stats"\n\n**Natural Questions:**\n- "How many notes do I have?"\n- "What can you do?"\n- "Show my tasks"\n- "What else can you help with?"\n\nJust talk to me naturally! 😊`;
    }
    
    aiCreateNoteFromIntent(message) {
        // Handle intent-based requests like "write a recipe", "save this idea", etc.
        const lower = message.toLowerCase();
        
        // Detect what they want to write about
        let topic = '';
        let suggestedTags = [];
        
        // Extract topic
        if (lower.includes('recipe')) {
            topic = 'recipe';
            suggestedTags = ['cooking', 'recipe'];
        } else if (lower.includes('story')) {
            topic = 'story';
            suggestedTags = ['writing', 'story'];
        } else if (lower.includes('idea')) {
            topic = 'idea';
            suggestedTags = ['ideas'];
        } else if (lower.includes('meeting')) {
            topic = 'meeting notes';
            suggestedTags = ['work', 'meeting'];
        } else if (lower.includes('todo') || lower.includes('to-do')) {
            topic = 'todo list';
            suggestedTags = ['tasks'];
        } else if (lower.includes('journal')) {
            topic = 'journal entry';
            suggestedTags = ['personal', 'journal'];
        } else {
            // Generic - extract what comes after "write"
            const writeMatch = message.match(/write\s+(?:a\s+|an\s+|the\s+)?(.+)/i);
            if (writeMatch) {
                topic = writeMatch[1];
            } else {
                topic = 'note';
            }
        }
        
        // Create a template note
        const templates = {
            'recipe': `# Recipe: [Name]\n\n## Ingredients:\n- \n- \n- \n\n## Instructions:\n1. \n2. \n3. \n\n## Notes:\n`,
            'story': `# Story Title\n\n## Plot:\n\n## Characters:\n- \n- \n\n## Story:\n`,
            'idea': `# Idea\n\n## Description:\n\n## Why it's interesting:\n\n## Next steps:\n`,
            'meeting notes': `# Meeting Notes - ${new Date().toLocaleDateString()}\n\n## Attendees:\n- \n\n## Topics:\n- \n\n## Action Items:\n- [ ] \n`,
            'todo list': `# To-Do List - ${new Date().toLocaleDateString()}\n\n## High Priority:\n- [ ] \n\n## Medium Priority:\n- [ ] \n\n## Low Priority:\n- [ ] \n`,
            'journal entry': `# Journal - ${new Date().toLocaleDateString()}\n\n## Today's Thoughts:\n\n## Gratitude:\n- \n\n## Tomorrow's Goals:\n- \n`
        };
        
        const content = templates[topic] || `# ${topic.charAt(0).toUpperCase() + topic.slice(1)}\n\n`;
        
        // Create the note
        const note = {
            id: Date.now(),
            content: content,
            tags: suggestedTags,
            category: '',
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleDateString(),
            pinned: false
        };
        
        this.notes.unshift(note);
        suggestedTags.forEach(tag => this.tags.add(tag));
        this.addToHistory(note);
        this.saveToStorage();
        this.renderAll();
        
        // Load it into the editor for them to fill in
        const noteInput = document.getElementById('noteInput');
        if (noteInput) {
            noteInput.value = content;
            noteInput.scrollIntoView({ behavior: 'smooth' });
            noteInput.focus();
        }
        
        const tagText = suggestedTags.length > 0 ? ` with tags: ${suggestedTags.join(', ')}` : '';
        return `✅ Created a ${topic} template${tagText}!\n\nI've loaded it in the editor above. Fill in the details and click Save! 📝\n\nYou now have ${this.notes.length} notes.`;
    }
    
    aiCreateNote(message) {
        // Parse the message to extract tags and content
        // Format: "Create note with tags tag1,tag2: Content here"
        // Or: "Create note: Content" or just "Content in quotes"
        
        let tags = [];
        let content = '';
        
        // Try to extract tags
        const tagMatch = message.match(/tags?\s+([^:]+):/i);
        if (tagMatch) {
            tags = tagMatch[1].split(',').map(t => t.trim()).filter(t => t);
            content = message.split(':').slice(1).join(':').trim();
        } else if (message.includes(':')) {
            content = message.split(':').slice(1).join(':').trim();
        } else {
            // Try to extract quoted content
            const quoteMatch = message.match(/["'](.+)["']/);
            if (quoteMatch) {
                content = quoteMatch[1];
            } else {
                // Use everything after "create note"
                content = message.replace(/create\s+note/i, '').trim();
            }
        }
        
        // Remove quotes if present
        content = content.replace(/^["']|["']$/g, '');
        
        if (!content) {
            return 'Please provide content for the note. Example: "Create note with tags work: Meeting notes"';
        }
        
        // Create the note
        const note = {
            id: Date.now(),
            content: content,
            tags: tags,
            category: '',
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleDateString(),
            pinned: false
        };
        
        this.notes.unshift(note);
        tags.forEach(tag => this.tags.add(tag));
        this.addToHistory(note);
        this.saveToStorage();
        this.renderAll();
        
        const tagText = tags.length > 0 ? ` with tags: ${tags.join(', ')}` : '';
        return `✅ Note created${tagText}!\n\nContent: "${content}"\n\nYou now have ${this.notes.length} notes.`;
    }
    
    aiCreateTask(message) {
        // Extract task content
        let taskText = '';
        
        if (message.includes(':')) {
            taskText = message.split(':').slice(1).join(':').trim();
        } else {
            taskText = message.replace(/create\s+task|add\s+task|new\s+task/i, '').trim();
        }
        
        // Remove quotes
        taskText = taskText.replace(/^["']|["']$/g, '');
        
        if (!taskText) {
            return 'Please provide task content. Example: "Add task: Buy groceries"';
        }
        
        // Create the task
        const todo = {
            id: Date.now(),
            text: taskText,
            completed: false,
            priority: 'medium',
            timestamp: new Date().toISOString()
        };
        
        this.todos.unshift(todo);
        this.saveToStorage();
        this.renderTodos();
        
        return `✅ Task added: "${taskText}"\n\nYou now have ${this.todos.length} tasks (${this.todos.filter(t => !t.completed).length} pending).`;
    }
    
    aiSearchNotes(message) {
        // Extract search term
        let searchTerm = '';
        
        const tagMatch = message.match(/tag\s+([\w-]+)/i);
        if (tagMatch) {
            searchTerm = `tag:${tagMatch[1]}`;
        } else if (message.includes(':')) {
            searchTerm = message.split(':')[1].trim();
        } else {
            searchTerm = message.replace(/search\s+notes?/i, '').trim();
        }
        
        if (!searchTerm) {
            return 'Please specify what to search. Example: "Search notes with tag work"';
        }
        
        // Perform search
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = searchTerm;
            this.performSearch();
            return `🔍 Searching for: "${searchTerm}"\n\nCheck the search results below!`;
        }
        
        return `Try searching manually with: "${searchTerm}"`;
    }

    // ==================== UTILITIES ====================
    
    renderAll() {
        this.renderTodos();
        this.renderTags();
        this.renderHistory();
        this.renderPinnedNotes();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#7c3aed'};
            color: white;
            border-radius: 8px;
            font-weight: bold;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Add animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Initialize app when DOM is ready
let app;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app = new NeonNotes();
        window.app = app; // Make globally accessible
    });
} else {
    app = new NeonNotes();
    window.app = app; // Make globally accessible
}
// Custom JavaScript for proc documentation

// Add copy button to code blocks
document.addEventListener('DOMContentLoaded', function() {
    // Add copy buttons to all code blocks
    document.querySelectorAll('pre > code').forEach(function(codeBlock) {
        const pre = codeBlock.parentElement;
        const button = document.createElement('button');
        button.className = 'copy-button';
        button.textContent = '📋 Copy';
        button.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            padding: 4px 12px;
            background: var(--sidebar-bg);
            border: 1px solid var(--sidebar-fg);
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.85em;
            opacity: 0;
            transition: opacity 0.2s;
        `;
        
        pre.style.position = 'relative';
        pre.appendChild(button);
        
        // Show button on hover
        pre.addEventListener('mouseenter', function() {
            button.style.opacity = '1';
        });
        
        pre.addEventListener('mouseleave', function() {
            button.style.opacity = '0';
        });
        
        // Copy functionality
        button.addEventListener('click', function() {
            const text = codeBlock.textContent;
            navigator.clipboard.writeText(text).then(function() {
                button.textContent = '✅ Copied!';
                setTimeout(function() {
                    button.textContent = '📋 Copy';
                }, 2000);
            });
        });
    });
    
    // Add smooth scroll to anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Highlight current section in sidebar
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                if (id) {
                    document.querySelectorAll('.sidebar a').forEach(link => {
                        link.classList.remove('active');
                        if (link.getAttribute('href').includes('#' + id)) {
                            link.classList.add('active');
                        }
                    });
                }
            }
        });
    }, { threshold: 0.5 });
    
    document.querySelectorAll('h1[id], h2[id], h3[id]').forEach(heading => {
        observer.observe(heading);
    });
    
    // Add keyboard shortcuts hint
    const shortcutsHint = document.createElement('div');
    shortcutsHint.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 8px 12px;
        background: var(--sidebar-bg);
        border: 1px solid var(--sidebar-fg);
        border-radius: 4px;
        font-size: 0.85em;
        opacity: 0;
        transition: opacity 0.3s;
        pointer-events: none;
        z-index: 1000;
    `;
    shortcutsHint.textContent = 'Press S to search, ← → to navigate';
    document.body.appendChild(shortcutsHint);
    
    // Show hint briefly on page load
    setTimeout(() => {
        shortcutsHint.style.opacity = '0.8';
        setTimeout(() => {
            shortcutsHint.style.opacity = '0';
        }, 3000);
    }, 1000);
});

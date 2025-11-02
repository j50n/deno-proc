// Populate the sidebar
//
// This is a script, and not included directly in the page, to control the total size of the book.
// The TOC contains an entry for each page, so if each page includes a copy of the TOC,
// the total size of the page becomes O(n**2).
class MDBookSidebarScrollbox extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        this.innerHTML = '<ol class="chapter"><li class="chapter-item expanded affix "><a href="introduction.html">Introduction</a></li><li class="chapter-item expanded affix "><li class="spacer"></li><li class="chapter-item expanded affix "><li class="part-title">Getting Started</li><li class="chapter-item expanded "><a href="getting-started/installation.html"><strong aria-hidden="true">1.</strong> Installation</a></li><li class="chapter-item expanded "><a href="getting-started/quick-start.html"><strong aria-hidden="true">2.</strong> Quick Start</a></li><li class="chapter-item expanded "><a href="getting-started/key-concepts.html"><strong aria-hidden="true">3.</strong> Key Concepts</a></li><li class="chapter-item expanded "><a href="patterns.html"><strong aria-hidden="true">4.</strong> Common Patterns</a></li><li class="chapter-item expanded affix "><li class="part-title">Core Features</li><li class="chapter-item expanded "><a href="core/error-handling.html"><strong aria-hidden="true">5.</strong> Error Handling</a></li><li class="chapter-item expanded "><a href="core/running-processes.html"><strong aria-hidden="true">6.</strong> Running Processes</a></li><li class="chapter-item expanded "><a href="core/pipelines.html"><strong aria-hidden="true">7.</strong> Process Pipelines</a></li><li class="chapter-item expanded "><a href="core/output.html"><strong aria-hidden="true">8.</strong> Working with Output</a></li><li class="chapter-item expanded "><a href="core/input.html"><strong aria-hidden="true">9.</strong> Working with Input</a></li><li class="chapter-item expanded "><a href="core/resources.html"><strong aria-hidden="true">10.</strong> Resource Management</a></li><li class="chapter-item expanded affix "><li class="part-title">Async Iterables</li><li class="chapter-item expanded "><a href="iterables/enumerable.html"><strong aria-hidden="true">11.</strong> Understanding Enumerable</a></li><li class="chapter-item expanded "><a href="iterables/array-methods.html"><strong aria-hidden="true">12.</strong> Array-Like Methods</a></li><li class="chapter-item expanded "><a href="iterables/transformations.html"><strong aria-hidden="true">13.</strong> Transformations</a></li><li class="chapter-item expanded "><a href="iterables/aggregations.html"><strong aria-hidden="true">14.</strong> Aggregations</a></li><li class="chapter-item expanded "><a href="iterables/slicing.html"><strong aria-hidden="true">15.</strong> Slicing and Sampling</a></li><li class="chapter-item expanded affix "><li class="part-title">Advanced Topics</li><li class="chapter-item expanded "><a href="advanced/concurrent.html"><strong aria-hidden="true">16.</strong> Concurrent Processing</a></li><li class="chapter-item expanded "><a href="advanced/streaming.html"><strong aria-hidden="true">17.</strong> Streaming Large Files</a></li><li class="chapter-item expanded affix "><li class="part-title">Utilities</li><li class="chapter-item expanded "><a href="utilities/file-io.html"><strong aria-hidden="true">18.</strong> File I/O</a></li><li class="chapter-item expanded "><a href="utilities/range.html"><strong aria-hidden="true">19.</strong> Range and Iteration</a></li><li class="chapter-item expanded "><a href="utilities/zip-enumerate.html"><strong aria-hidden="true">20.</strong> Zip and Enumerate</a></li><li class="chapter-item expanded "><a href="utilities/writable-iterable.html"><strong aria-hidden="true">21.</strong> WritableIterable</a></li><li class="chapter-item expanded "><a href="utilities/sleep.html"><strong aria-hidden="true">22.</strong> Sleep</a></li><li class="chapter-item expanded affix "><li class="part-title">Recipes</li><li class="chapter-item expanded "><a href="recipes/counting-words.html"><strong aria-hidden="true">23.</strong> Counting Words</a></li><li class="chapter-item expanded "><a href="recipes/log-processing.html"><strong aria-hidden="true">24.</strong> Processing Log Files</a></li><li class="chapter-item expanded "><a href="recipes/decompression.html"><strong aria-hidden="true">25.</strong> Decompressing Files</a></li><li class="chapter-item expanded "><a href="recipes/parallel-downloads.html"><strong aria-hidden="true">26.</strong> Parallel Downloads</a></li><li class="chapter-item expanded "><a href="recipes/shell-replacement.html"><strong aria-hidden="true">27.</strong> Shell Script Replacement</a></li><li class="chapter-item expanded affix "><li class="spacer"></li><li class="chapter-item expanded affix "><a href="api-reference.html">API Reference</a></li><li class="chapter-item expanded affix "><a href="migration.html">Migration Guide</a></li><li class="chapter-item expanded affix "><a href="faq.html">FAQ</a></li></ol>';
        // Set the current, active page, and reveal it if it's hidden
        let current_page = document.location.href.toString().split("#")[0].split("?")[0];
        if (current_page.endsWith("/")) {
            current_page += "index.html";
        }
        var links = Array.prototype.slice.call(this.querySelectorAll("a"));
        var l = links.length;
        for (var i = 0; i < l; ++i) {
            var link = links[i];
            var href = link.getAttribute("href");
            if (href && !href.startsWith("#") && !/^(?:[a-z+]+:)?\/\//.test(href)) {
                link.href = path_to_root + href;
            }
            // The "index" page is supposed to alias the first chapter in the book.
            if (link.href === current_page || (i === 0 && path_to_root === "" && current_page.endsWith("/index.html"))) {
                link.classList.add("active");
                var parent = link.parentElement;
                if (parent && parent.classList.contains("chapter-item")) {
                    parent.classList.add("expanded");
                }
                while (parent) {
                    if (parent.tagName === "LI" && parent.previousElementSibling) {
                        if (parent.previousElementSibling.classList.contains("chapter-item")) {
                            parent.previousElementSibling.classList.add("expanded");
                        }
                    }
                    parent = parent.parentElement;
                }
            }
        }
        // Track and set sidebar scroll position
        this.addEventListener('click', function(e) {
            if (e.target.tagName === 'A') {
                sessionStorage.setItem('sidebar-scroll', this.scrollTop);
            }
        }, { passive: true });
        var sidebarScrollTop = sessionStorage.getItem('sidebar-scroll');
        sessionStorage.removeItem('sidebar-scroll');
        if (sidebarScrollTop) {
            // preserve sidebar scroll position when navigating via links within sidebar
            this.scrollTop = sidebarScrollTop;
        } else {
            // scroll sidebar to current active section when navigating via "next/previous chapter" buttons
            var activeSection = document.querySelector('#sidebar .active');
            if (activeSection) {
                activeSection.scrollIntoView({ block: 'center' });
            }
        }
        // Toggle buttons
        var sidebarAnchorToggles = document.querySelectorAll('#sidebar a.toggle');
        function toggleSection(ev) {
            ev.currentTarget.parentElement.classList.toggle('expanded');
        }
        Array.from(sidebarAnchorToggles).forEach(function (el) {
            el.addEventListener('click', toggleSection);
        });
    }
}
window.customElements.define("mdbook-sidebar-scrollbox", MDBookSidebarScrollbox);

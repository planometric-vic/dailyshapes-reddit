// Set the current date in the header immediately
(function() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const month = months[now.getMonth()];
    const day = now.getDate();
    const dateSpan = document.querySelector('#dateTitle .date-light');
    if (dateSpan) {
        dateSpan.textContent = month + ' ' + day;
    }
})();

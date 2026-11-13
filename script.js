// Automatically update the copyright year.
document.getElementById("year").textContent = new Date().getFullYear();

// Reveal elements when they enter the screen.
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  });
}, {
  threshold: 0.12
});

// Observe every element with the "reveal" class.
document.querySelectorAll(".reveal").forEach((element) => {
  observer.observe(element);
});

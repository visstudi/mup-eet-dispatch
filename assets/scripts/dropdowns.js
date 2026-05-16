"use strict";

const dropdownButtons = document.getElementsByClassName("dropdown-button");

function resizeDropdownElements() {
  Array.from(dropdownButtons).forEach((dropdownButton) => {
    document.getElementsByClassName("dropdown")[0].style.height =
      `${dropdownButton.scrollHeight}px`;

    document.getElementsByClassName("dropdown-content")[0].style.top =
      `${dropdownButton.scrollHeight / 2}px`;

    document.getElementsByClassName(
      "dropdown-content",
    )[0].children[0].style.height = `${dropdownButton.scrollHeight / 2}px`;
  });
}

Array.from(dropdownButtons).forEach((dropdownButton) => {
  dropdownButton.addEventListener("click", (event) => {
    if (dropdownButton.parentElement.classList.contains("active")) {
      dropdownButton.nextElementSibling.style.maxHeight = `0px`;
    } else {
      dropdownButton.nextElementSibling.style.maxHeight = `${dropdownButton.nextElementSibling.scrollHeight}px`;
    }

    dropdownButton.parentElement.classList.toggle("active");
  });
});

window.addEventListener("resize", (event) => {
  resizeDropdownElements();
});

resizeDropdownElements();

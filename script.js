'use strict';

// Homepage interactions are deliberately independent of future account/booking APIs.
const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
function closeMenu() {
  navigation.classList.remove('is-open');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Open navigation');
}
menuButton.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') !== 'true';
  navigation.classList.toggle('is-open', isOpen);
  menuButton.setAttribute('aria-expanded', String(isOpen));
  menuButton.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
});
navigation.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('click', event => { if (!event.target.closest('.nav-wrap')) closeMenu(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menuButton.focus();
  }
});
window.matchMedia('(min-width: 851px)').addEventListener('change', event => { if (event.matches) closeMenu(); });

const experiences = {
  conversation: { title: 'Just a conversation', text: 'Sometimes a little space to talk makes a difference. Share everyday thoughts, chat about your interests, or spend some time with someone who listens.', boundary: 'Everyday companionship only. This is not therapy, counselling, or crisis support.' },
  coffee: { title: 'Coffee & company', text: 'A new café or an old favourite. Make time for an easy conversation over coffee with a platonic companion.', boundary: 'Meet in a public café. Agree on the meeting length and who covers food and drinks beforehand.' },
  movie: { title: 'Movies & more', text: 'Catch a film together and share your take afterwards. A simple way to enjoy a movie with someone who likes a little cinema conversation.', boundary: 'Choose a public cinema. Agree on tickets, timing, and any other costs before meeting.' },
  shopping: { title: 'Shopping companion', text: 'Browse a market, pick an outfit, or explore the shops with a companion for the afternoon.', boundary: 'Meet in public shopping areas. Purchases and expenses must be agreed separately; never share account credentials.' },
  event: { title: 'Wedding & event plus-one', text: 'A friendly face by your side at a wedding or social event. Attend together as platonic companions with clear expectations.', boundary: 'Respect the event host’s rules. Agree on timing and costs, and never require romantic role-play or physical intimacy.' },
  walking: { title: 'Walks & outings', text: 'Take a leisurely walk or explore a local public spot together. A little fresh air, conversation, and company.', boundary: 'Choose well-used public places and sensible meeting times. Share your plans with someone you trust.' },
  chat: { title: 'Online chat', text: 'Connect over everyday interests, a shared hobby, or a conversation from the comfort of your own space.', boundary: 'Keep conversations respectful and non-sexual. Protect your personal information and never share passwords or payment codes.' },
  phone: { title: 'Phone conversations', text: 'Make time for a friendly voice and an unhurried conversation, wherever you are in India.', boundary: 'Call arrangements will be shared when the service launches. Respect privacy; do not record someone without their consent.' },
  social: { title: 'Other social plans', text: 'A bookshop visit, a public exhibition, or another safe social activity. There is room for different interests and everyday plans.', boundary: 'All activities must be legal, public where applicable, and strictly platonic. Agree on the activity and boundaries in advance.' }
};
const dialog = document.querySelector('#info-dialog');
const dialogContent = document.querySelector('#dialog-content');
let dialogTrigger = null;
function paragraph(text, className) {
  const element = document.createElement('p');
  element.textContent = text;
  if (className) element.className = className;
  return element;
}
function statusBox(title, message) {
  const box = document.createElement('div');
  box.className = 'dialog-status';
  const heading = document.createElement('strong');
  heading.textContent = title;
  box.append(heading, paragraph(message));
  return box;
}
function openDialog(trigger, eyebrow, title, contents) {
  dialogTrigger = trigger;
  document.querySelector('#dialog-eyebrow').textContent = eyebrow;
  document.querySelector('#dialog-title').textContent = title;
  dialogContent.replaceChildren(...contents);
  closeMenu();
  dialog.showModal();
  document.body.classList.add('modal-open');
}
document.querySelectorAll('[data-experience]').forEach(button => {
  button.addEventListener('click', () => {
    const experience = experiences[button.dataset.experience];
    openDialog(button, 'EXPLORE AN EXPERIENCE · 18+ ONLY', experience.title, [
      paragraph(experience.text),
      statusBox('Companion discovery is coming soon', 'Live profiles and bookings are not available yet. No booking or payment is being taken on this website.'),
      paragraph(experience.boundary, 'dialog-boundary')
    ]);
  });
});
document.querySelectorAll('[data-info]').forEach(button => {
  button.addEventListener('click', () => {
    if (button.dataset.info === 'companion') {
      openDialog(button, 'BECOME A SATHIVO COMPANION', 'Your company can mean a lot.', [
        paragraph('We’re preparing a space where adults can offer strictly platonic companionship, choose their availability, and set their own rates.'),
        statusBox('Applications are not open yet', 'Profile creation and applications will be available in a future release. This page does not collect personal information or register you as a companion.'),
        paragraph('You must be 18 or older and agree to our boundaries. Sexual services, escort services, and sexual offers are strictly prohibited.', 'dialog-boundary')
      ]);
    } else if (button.dataset.info === 'guidelines') {
      const list = document.createElement('ul');
      ['Adults 18+ only, for customers and companions alike.', 'Strictly platonic: no sexual services, sexual offers, escort services, or sexual activity.', 'Respect consent and boundaries. No harassment, discrimination, coercion, or pressure.', 'For in-person activities, meet in a public place and share your plans with someone you trust.', 'Agree on the activity, duration, costs, and boundaries before meeting.', 'Protect your privacy. Never share passwords, payment codes, or sensitive personal documents in a conversation.', 'Leave an uncomfortable situation. Contact local emergency services if you are in immediate danger.'].forEach(text => {
        const item = document.createElement('li'); item.textContent = text; list.append(item);
      });
      openDialog(button, 'OUR COMMUNITY EXPECTATIONS', 'Kindness. Respect. Boundaries.', [
        paragraph('These principles define the service we are building. Full service terms, verification details, and reporting procedures will be published before bookings open.'), list
      ]);
    } else if (button.dataset.info === 'privacy') {
      openDialog(button, 'ABOUT THIS WEBSITE RELEASE', 'Website privacy', [
        paragraph('This homepage has no payment collection, contact forms, analytics scripts, or advertising trackers. It does not store your interactions in browser storage. The linked account screens are a preview: signup and sign-in are not open, and those forms do not submit personal information in this release.'),
        paragraph('The page requests fonts from Google Fonts. Your browser sends network information, including your IP address, when requesting those fonts. The hosting provider may also keep normal access logs.'),
        paragraph('The account page explains the planned handling of account information and sign-in sessions. A full privacy policy, support contact and account deletion process will be published before public signup opens.')
      ]);
    }
  });
});
document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
document.querySelector('.dialog-done').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  const rect = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
});
dialog.addEventListener('close', () => {
  document.body.classList.remove('modal-open');
  if (dialogTrigger) dialogTrigger.focus();
});
document.querySelector('#year').textContent = new Date().getFullYear();

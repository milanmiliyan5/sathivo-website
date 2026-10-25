'use strict';

// Homepage interactions are deliberately independent of future account/booking APIs.
const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
function closeMenu() {
  navigation.classList.remove('is-open');
  navigation.querySelectorAll('details.nav-more').forEach(details => { details.open = false; });
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
document.addEventListener('click', event => {
  if (!event.target.closest('.nav-wrap')) closeMenu();
  else if (!event.target.closest('details.nav-more')) {
    navigation.querySelectorAll('details.nav-more').forEach(details => { details.open = false; });
  }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    const more = navigation.querySelector('details.nav-more[open]');
    if (more) {
      more.open = false;
      more.querySelector('summary')?.focus();
    } else if (menuButton.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      menuButton.focus();
    }
  }
});
window.matchMedia('(min-width: 1021px)').addEventListener('change', event => { if (event.matches) closeMenu(); });

const experiences = {
  conversation: { title: 'Just a conversation', text: 'Sometimes a little space to talk makes a difference. Share everyday thoughts, chat about your interests, or spend some time with someone who listens.', boundary: 'Everyday companionship only. This is not therapy, counselling, or crisis support.' },
  coffee: { title: 'Coffee & company', text: 'A new café or an old favourite. Make time for an easy conversation over coffee with a platonic companion.', boundary: 'Meet in a public café. Agree on the meeting length and who covers food and drinks beforehand.' },
  movie: { title: 'Movies & more', text: 'Catch a film together and share your take afterwards. A simple way to enjoy a movie with someone who likes a little cinema conversation.', boundary: 'Choose a public cinema. Agree on tickets, timing, and any other costs before meeting.' },
  shopping: { title: 'Shopping companion', text: 'Browse a market, pick an outfit, or explore the shops with a companion for the afternoon.', boundary: 'Meet in public shopping areas. Purchases and expenses must be agreed separately; never share account credentials.' },
  event: { title: 'Wedding & event plus-one', text: 'A friendly face by your side at a wedding or social event. Attend together as platonic companions with clear expectations.', boundary: 'Respect the event host’s rules. Agree on timing and costs, and never require romantic role-play or physical intimacy.' },
  walking: { title: 'Walks & outings', text: 'Take a leisurely walk or explore a local public spot together. A little fresh air, conversation, and company.', boundary: 'Choose well-used public places and sensible meeting times. Share your plans with someone you trust.' },
  chat: { title: 'Online chat', text: 'Connect over everyday interests, a shared hobby, or a conversation from the comfort of your own space.', boundary: 'Keep conversations respectful and non-sexual. Protect your personal information and never share passwords or payment codes.' },
  phone: { title: 'Phone conversations', text: 'Make time for a friendly voice and an unhurried conversation, wherever you are in India.', boundary: 'Agree on call arrangements in your booking chat after acceptance. Respect privacy; do not record someone without their consent.' },
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
      statusBox('Companion discovery is open', 'Use Find a companion to browse published profiles, see hourly rates and send a booking request with your own offer. Sathivo does not collect payment.'),
      paragraph(experience.boundary, 'dialog-boundary')
    ]);
  });
});
document.querySelectorAll('[data-info]').forEach(button => {
  button.addEventListener('click', () => {
    if (button.dataset.info === 'companion') {
      openDialog(button, 'BECOME A SATHIVO COMPANION', 'Your company can mean a lot.', [
        paragraph('Adults can offer strictly platonic companionship, choose their availability and set their own hourly rates.'),
        statusBox('Companion profiles are open', 'Create your profile, set your hourly companionship rate and publish when ready. Customers can send an offer; you choose whether to accept.'),
        paragraph('You must be 18 or older and agree to our boundaries. Sexual services, escort services, and sexual offers are strictly prohibited.', 'dialog-boundary')
      ]);
    } else if (button.dataset.info === 'guidelines') {
      const list = document.createElement('ul');
      ['Adults 18+ only, for customers and companions alike.', 'Strictly platonic: no sexual services, sexual offers, escort services, or sexual activity.', 'Respect consent and boundaries. No harassment, discrimination, coercion, or pressure.', 'For in-person activities, meet in a public place and share your plans with someone you trust.', 'Agree on the activity, duration, costs, and boundaries before meeting.', 'Protect your privacy. Never share passwords, payment codes, or sensitive personal documents in a conversation.', 'Leave an uncomfortable situation. Contact local emergency services if you are in immediate danger.'].forEach(text => {
        const item = document.createElement('li'); item.textContent = text; list.append(item);
      });
      openDialog(button, 'OUR COMMUNITY EXPECTATIONS', 'Kindness. Respect. Boundaries.', [
        paragraph('These principles apply to every Sathivo booking. Read our Terms of Use and Safety pages for service boundaries and reporting options. Profiles are self-described; identity and age are not verified.'), list
      ]);
    } else if (button.dataset.info === 'privacy') {
      openDialog(button, 'ABOUT THIS WEBSITE RELEASE', 'Website privacy', [
        paragraph('Sathivo does not process booking payments. This homepage may remember that you dismissed the introductory welcome message so it does not appear repeatedly. Sathivo also uses limited visitor tracking and platform services described in our Privacy Policy. Supabase handles account signup and sign-in; authentication emails are delivered through our email provider.'),
        paragraph('The page requests fonts from Google Fonts. Your browser sends network information, including your IP address, when requesting those fonts. The hosting provider may also keep normal access logs.'),
        paragraph('Learn more in our Privacy Policy, Terms of Use and Support pages. You can request permanent account deletion from the Delete account page.')
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

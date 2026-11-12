// The time and weather board: weather icon, date, year, clock, and today's festival or
// birthday. Everything about how it looks — the panel art, where each piece of text goes,
// fonts and colours — comes from the HUD pack's spec (assets/time_weather_hud.json). It
// is laid out in the panel's own pixels inside a container, which the HUD scene then
// scales by a whole number and pins to the top-right corner.

import { ShadowText, fitText, centeredX, textWidth } from './pixelText.js';

// Texture keys for the pack's HUD art (queued by BootScene).
export const HUD_TEX = {
  panel: 'hud:panel',
  weather: (type) => `hud:weather:${type}`,
  event: (type) => `hud:event:${type}`,
};

export default class TimePanel {
  constructor(scene, spec) {
    this.scene = scene;
    this.spec = spec;
    this.layout = spec.layout;
    [this.width, this.height] = spec.panel.size;

    const { layout } = this;
    this.root = scene.add.container(0, 0);
    this.root.add(scene.add.image(0, 0, HUD_TEX.panel).setOrigin(0, 0));

    const [iconX, iconY] = layout.weatherIcon.pos;
    this.weatherIcon = scene.add.image(iconX, iconY, HUD_TEX.weather('sunny')).setOrigin(0, 0);
    this.root.add(this.weatherIcon);

    this.date = new ShadowText(scene, this.root, layout.date.font);
    this.year = new ShadowText(scene, this.root, layout.year.font);
    this.clock = new ShadowText(scene, this.root, layout.clock.font);
    this.eventIcon = scene.add.image(0, layout.event.icon.topY, HUD_TEX.event('festival')).setOrigin(0, 0);
    this.root.add(this.eventIcon);
    this.event = new ShadowText(scene, this.root, layout.event.font);
  }

  // Show { weather, date, year, clock, event }: three strings, a weather type, and the
  // event to show ({ type, label }) or null when nothing is going on.
  render({ weather, date, year, clock, event }) {
    const { layout } = this;
    this.weatherIcon.setTexture(HUD_TEX.weather(weather));

    this.line(this.date, layout.date, date);
    this.line(this.year, layout.year, year);
    this.line(this.clock, layout.clock, clock);

    const ev = layout.event;
    if (!event) {
      this.eventIcon.setVisible(false);
      this.event.setCentered(ev.emptyText, ev.box, ev.lineTopY, ev.emptyColor, ev.emptyShadow);
      return;
    }
    // Icon, a small gap, then the label — centered in the box as one group.
    const label = fitText(this.scene, ev.font, event.label, ev.maxLabelWidth);
    const iconWidth = ev.icon.size[0] + ev.icon.gapToText;
    const x = centeredX(ev.box, iconWidth + textWidth(this.scene, ev.font, label));
    this.eventIcon.setTexture(HUD_TEX.event(event.type)).setX(x).setVisible(true);
    this.event.set(label, x + iconWidth, ev.lineTopY, ev.color, ev.shadow);
  }

  line(text, { box, lineTopY, color, shadow }, str) {
    text.setCentered(str, box, lineTopY, color, shadow);
  }

  // Pin to the top-right corner of a view `viewWidth` screen pixels wide.
  place(viewWidth, scale) {
    const [marginX, marginY] = this.spec.art.screenMargin;
    this.root.setScale(scale);
    this.root.setPosition(viewWidth - (this.width + marginX) * scale, marginY * scale);
  }
}

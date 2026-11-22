import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const catalog = JSON.parse(
  readFileSync(
    new URL("../seeds/course-catalog.json", import.meta.url),
    "utf8",
  ),
);
const courses = catalog.categories.flatMap((category) => category.courses);
const lessons = courses.flatMap((course) => course.lessons);
const normalized = (value) => value.normalize("NFC").toLocaleLowerCase("vi");

test("the demo catalog has six categories, 24 courses and 192 lessons", () => {
  assert.equal(catalog.version, 1);
  assert.equal(catalog.categories.length, 6);
  assert.equal(courses.length, 24);
  assert.equal(lessons.length, 192);
  for (const category of catalog.categories)
    assert.equal(category.courses.length, 4);
});

test("catalog keys are unique so repeatable imports can identify existing records", () => {
  const categoryNames = catalog.categories.map((category) =>
    normalized(category.name),
  );
  assert.equal(new Set(categoryNames).size, categoryNames.length);
  for (const category of catalog.categories) {
    const courseNames = category.courses.map((course) =>
      normalized(course.title),
    );
    assert.equal(new Set(courseNames).size, courseNames.length);
  }
  for (const course of courses) {
    const lessonNames = course.lessons.map((lesson) =>
      normalized(lesson.title),
    );
    assert.equal(new Set(lessonNames).size, lessonNames.length);
  }
});

test("names and descriptions fit the API and database contract", () => {
  for (const category of catalog.categories) {
    assert.ok(category.name.trim().length > 0 && category.name.length <= 100);
    assert.ok(category.description.length >= 40);
  }
  for (const course of courses) {
    assert.ok(course.title.trim().length > 0 && course.title.length <= 200);
    assert.ok(course.description.length >= 60);
    assert.ok(Number.isFinite(course.price) && course.price >= 0);
  }
});

test("every course has eight readable lessons with a specific exercise", () => {
  for (const course of courses) {
    assert.equal(course.lessons.length, 8);
    for (const lesson of course.lessons) {
      assert.ok(lesson.title.length > 0 && lesson.title.length <= 200);
      assert.ok(lesson.content.length >= 300);
      const exercise = lesson.content
        .split("BÀI TẬP THỰC HÀNH\n")[1]
        ?.split("\n\n")[0];
      assert.ok(exercise?.length >= 60, `${course.title}: ${lesson.title}`);
      assert.ok(!lesson.content.includes("undefined"));
    }
  }
});

test("the catalog exercises both free and paid course filters", () => {
  assert.equal(courses.filter((course) => course.price === 0).length, 6);
  assert.equal(courses.filter((course) => course.price > 0).length, 18);
  assert.ok(new Set(courses.map((course) => course.price)).size >= 4);
});

test("lesson durations are positive whole minutes", () => {
  for (const lesson of lessons) {
    assert.ok(Number.isInteger(lesson.durationMinutes));
    assert.ok(lesson.durationMinutes > 0 && lesson.durationMinutes <= 180);
  }
});

import { db } from "@workspace/db";
import { usersTable, curriculaTable, lecturesTable } from "@workspace/db/schema";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Seeding database...");

  // Admin user
  const adminHash = await bcrypt.hash("admin123", 12);
  await db
    .insert(usersTable)
    .values({
      username: "admin",
      fullName: "Norv Admin",
      passwordHash: adminHash,
      role: "admin",
      setupComplete: true,
      specialization: "Software Engineering",
      skillLevel: "advanced",
    })
    .onConflictDoNothing();

  // Sample student
  const studentHash = await bcrypt.hash("student123", 12);
  await db
    .insert(usersTable)
    .values({
      username: "demo_student",
      fullName: "Ahmad Khalil",
      passwordHash: studentHash,
      role: "student",
      setupComplete: true,
      university: "University of Jordan",
      major: "Computer Science",
      yearOfStudy: 3,
      specialization: "Web Development",
      skillLevel: "intermediate",
      knownLanguages: ["JavaScript", "Python", "SQL"],
    })
    .onConflictDoNothing();

  // Sample curricula
  const [webCurriculum] = await db
    .insert(curriculaTable)
    .values([
      {
        name: "Full-Stack Web Development",
        description: "Complete curriculum from HTML/CSS to React and Node.js",
        specialization: "Web Development",
      },
      {
        name: "Cybersecurity Fundamentals",
        description: "Network security, ethical hacking, and security protocols",
        specialization: "Cybersecurity",
      },
      {
        name: "AI & Machine Learning Basics",
        description: "Introduction to ML algorithms and Python data science tools",
        specialization: "AI & Machine Learning",
      },
    ])
    .returning();

  // Sample lectures
  await db.insert(lecturesTable).values([
    {
      title: "Introduction to HTML & CSS",
      youtubeId: "qz0aGYrrlhU",
      youtubeUrl: "https://www.youtube.com/watch?v=qz0aGYrrlhU",
      instructor: "Traversy Media",
      description:
        "Learn the fundamentals of HTML5 and CSS3. Build your first webpage from scratch.",
      specialization: "Web Development",
      difficulty: "beginner",
      durationMinutes: 70,
      curriculumId: webCurriculum?.id,
    },
    {
      title: "JavaScript Full Course for Beginners",
      youtubeId: "PkZNo7MFNFg",
      youtubeUrl: "https://www.youtube.com/watch?v=PkZNo7MFNFg",
      instructor: "freeCodeCamp",
      description:
        "Complete JavaScript course covering ES6+, DOM manipulation, async/await, and more.",
      specialization: "Web Development",
      difficulty: "beginner",
      durationMinutes: 212,
      curriculumId: webCurriculum?.id,
    },
    {
      title: "React JS Full Course",
      youtubeId: "b9eMGE7QtTk",
      youtubeUrl: "https://www.youtube.com/watch?v=b9eMGE7QtTk",
      instructor: "Dave Gray",
      description:
        "Build modern React apps with hooks, context, React Router, and more.",
      specialization: "Web Development",
      difficulty: "intermediate",
      durationMinutes: 140,
      curriculumId: webCurriculum?.id,
    },
    {
      title: "Python for Beginners - Full Course",
      youtubeId: "_uQrJ0TkZlc",
      youtubeUrl: "https://www.youtube.com/watch?v=_uQrJ0TkZlc",
      instructor: "Programming with Mosh",
      description:
        "Learn Python from scratch. Variables, control flow, functions, OOP, and more.",
      specialization: "Programming & Development",
      difficulty: "beginner",
      durationMinutes: 360,
    },
    {
      title: "Data Structures and Algorithms in Python",
      youtubeId: "pkYVOmU3MgA",
      youtubeUrl: "https://www.youtube.com/watch?v=pkYVOmU3MgA",
      instructor: "freeCodeCamp",
      description:
        "Master DSA concepts: arrays, linked lists, trees, graphs, sorting, and searching.",
      specialization: "Programming & Development",
      difficulty: "intermediate",
      durationMinutes: 120,
    },
    {
      title: "Cybersecurity for Beginners",
      youtubeId: "U_P23SqJaDc",
      youtubeUrl: "https://www.youtube.com/watch?v=U_P23SqJaDc",
      instructor: "NetworkChuck",
      description:
        "Introduction to cybersecurity concepts, threats, and basic defensive strategies.",
      specialization: "Cybersecurity",
      difficulty: "beginner",
      durationMinutes: 45,
    },
    {
      title: "Machine Learning Course for Beginners",
      youtubeId: "NWONeJKn6kc",
      youtubeUrl: "https://www.youtube.com/watch?v=NWONeJKn6kc",
      instructor: "freeCodeCamp",
      description:
        "Learn ML fundamentals: supervised learning, neural networks, and scikit-learn.",
      specialization: "AI & Machine Learning",
      difficulty: "intermediate",
      durationMinutes: 180,
    },
    {
      title: "SQL Full Tutorial - Complete Database Course",
      youtubeId: "HXV3zeQKqGY",
      youtubeUrl: "https://www.youtube.com/watch?v=HXV3zeQKqGY",
      instructor: "freeCodeCamp",
      description:
        "Complete SQL guide: queries, joins, aggregations, stored procedures.",
      specialization: "Databases",
      difficulty: "beginner",
      durationMinutes: 270,
    },
  ]);

  console.log("Database seeded successfully!");
  console.log("Admin: username=admin, password=admin123");
  console.log("Student: username=demo_student, password=student123");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

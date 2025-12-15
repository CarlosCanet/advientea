import { Day, User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createTeaGuess, getAllGuesses, getLastGuess, TeaWithIngredients } from "@/lib/dal";
import { it, expect, describe, beforeEach } from "vitest";
import { TeaGuessFormData } from "@/lib/types";

describe("Dal tea guess", async () => {
  let testUser: User;
  let testDay1: Day;
  let testDay2: Day;
  let guessComplete1: TeaGuessFormData;
  let guessComplete2: TeaGuessFormData;
  let guessOnlyTeaName: TeaGuessFormData;
  let guessOnlyTeaType: TeaGuessFormData;
  let guessOnlyUserId: TeaGuessFormData;
  let guessOnlyGuestName: TeaGuessFormData;
  let guessOnlyIngredients: TeaGuessFormData;
  const TEST_POINTS = 300;

  beforeEach(async () => {
    const dayAssignmentRecord1 = await prisma.dayAssignment.findFirstOrThrow({ where: { user: { isNot: null }, day: { tea: { isNot: null } } }, include: { user: true, day: { include: { tea: { include: { ingredients: true } } } } } });
    const dayAssignmentRecord2 = await prisma.dayAssignment.findFirstOrThrow({ where: { user: null, day: { tea: { isNot: null } }, id: { not: dayAssignmentRecord1.id }, }, include: { user: true, day: { include: { tea: { include: { ingredients: true } } } } } });
    const ownerDay1 = dayAssignmentRecord1.user;
    testUser = await prisma.user.findFirstOrThrow({ where: { id: { not: ownerDay1!.id } } });
    testDay1 = dayAssignmentRecord1.day;
    testDay2 = dayAssignmentRecord2.day;
    if (!dayAssignmentRecord1.day.tea) throw new Error("DB test seed has no valid teas");
    if (!dayAssignmentRecord2.day.tea) throw new Error("DB test seed has no valid teas");
    const tea1: TeaWithIngredients = dayAssignmentRecord1.day.tea;
    const tea2: TeaWithIngredients = dayAssignmentRecord2.day.tea;
    guessComplete1 = {
      teaName: tea1?.name,
      teaType: tea1?.teaType,
      personName: ownerDay1?.id,
      personType: "userId",
      ingredients: tea1.ingredients.map(ingredient => ingredient.id),
    };
    guessComplete2 = {
      teaName: tea2?.name,
      teaType: tea2?.teaType,
      personName: dayAssignmentRecord2.guestName!,
      personType: "guestName",
      ingredients: tea2.ingredients.map(ingredient => ingredient.id),
    };
    guessOnlyTeaName = {
      teaName: tea2?.name,
    };
    guessOnlyTeaType = {
      teaType: tea2?.teaType,
    };
    guessOnlyUserId = {
      personName: ownerDay1?.id,
      personType: "userId",
    };
    guessOnlyGuestName = {
      personName: "Anónimo",
      personType: "guestName",
    };
    guessOnlyIngredients = {
      ingredients: tea1.ingredients.map(ingredient => ingredient.id),
    };
  });

  it("should create a guess correctly", async () => {
    const result1 = await createTeaGuess(testUser.id, testDay1.id, guessComplete1, TEST_POINTS);
    const result2 = await createTeaGuess(testUser.id, testDay2.id, guessComplete2, TEST_POINTS);
    const result3 = await createTeaGuess(testUser.id, testDay2.id, guessOnlyTeaName, TEST_POINTS);
    const result4 = await createTeaGuess(testUser.id, testDay2.id, guessOnlyTeaType, TEST_POINTS);
    const result5 = await createTeaGuess(testUser.id, testDay1.id, guessOnlyUserId, TEST_POINTS);
    const result6 = await createTeaGuess(testUser.id, testDay2.id, guessOnlyGuestName, TEST_POINTS);
    const result7 = await createTeaGuess(testUser.id, testDay2.id, guessOnlyIngredients, TEST_POINTS);
    expect(result1).toBeDefined();
    expect(result1?.userId).toBe(testUser.id);
    expect(result1?.dayId).toBe(testDay1.id);
    expect(result1?.guessedUserId).toBe(guessComplete1.personName);
    expect(result1?.guessedTeaName).toBe(guessComplete1.teaName);
    expect(result1?.guessedTeaType).toBe(guessComplete1.teaType);
    expect(result1?.guessedGuestName).toBeNull();
    const resultIngredients1 = result1?.guessedIngredients.map(ingredient => ingredient.id).sort();
    expect(resultIngredients1).toEqual(guessComplete1.ingredients?.sort());

    expect(result2).toBeDefined();
    expect(result2?.userId).toBe(testUser.id);
    expect(result2?.dayId).toBe(testDay2.id);
    expect(result2?.guessedUserId).toBeNull();
    expect(result2?.guessedGuestName).toBe(guessComplete2.personName);
    expect(result2?.guessedTeaName).toBe(guessComplete2.teaName);
    expect(result2?.guessedTeaType).toBe(guessComplete2.teaType);
    const resultIngredients2 = result2?.guessedIngredients.map(ingredient => ingredient.id).sort();
    expect(resultIngredients2).toEqual(guessComplete2.ingredients?.sort());

    expect(result3).toBeDefined();
    expect(result3?.userId).toBe(testUser.id);
    expect(result3?.dayId).toBe(testDay2.id);
    expect(result3?.guessedTeaName).toBe(guessOnlyTeaName.teaName);
    expect(result3?.guessedGuestName).toBeNull();
    expect(result3?.guessedTeaType).toBeNull();
    expect(result3?.guessedUserId).toBeNull();
    expect(result3?.guessedIngredients).toEqual([])

    expect(result4).toBeDefined();
    expect(result4?.userId).toBe(testUser.id);
    expect(result4?.dayId).toBe(testDay2.id);
    expect(result4?.guessedTeaType).toBe(guessOnlyTeaType.teaType);
    expect(result4?.guessedUserId).toBeNull();
    expect(result4?.guessedGuestName).toBeNull();
    expect(result4?.guessedTeaName).toBeNull();
    expect(result4?.guessedIngredients).toEqual([])
    
    expect(result5).toBeDefined();
    expect(result5?.userId).toBe(testUser.id);
    expect(result5?.dayId).toBe(testDay1.id);
    expect(result5?.guessedUserId).toBe(guessOnlyUserId.personName);
    expect(result5?.guessedGuestName).toBeNull();
    expect(result5?.guessedTeaType).toBeNull();
    expect(result5?.guessedTeaName).toBeNull();
    expect(result5?.guessedIngredients).toEqual([])
    
    expect(result6).toBeDefined();
    expect(result6?.userId).toBe(testUser.id);
    expect(result6?.dayId).toBe(testDay2.id);
    expect(result6?.guessedGuestName).toBe(guessOnlyGuestName.personName);
    expect(result6?.guessedUserId).toBeNull();
    expect(result6?.guessedTeaName).toBeNull();
    expect(result6?.guessedTeaType).toBeNull();
    expect(result6?.guessedIngredients).toEqual([])
    
    expect(result7).toBeDefined();
    expect(result7?.userId).toBe(testUser.id);
    expect(result7?.dayId).toBe(testDay2.id);
    expect(result7?.guessedGuestName).toBeNull();
    expect(result7?.guessedUserId).toBeNull();
    expect(result7?.guessedTeaName).toBeNull();
    expect(result7?.guessedTeaType).toBeNull();
    const resultIngredients7 = result7?.guessedIngredients.map(ingredient => ingredient.id).sort();
    expect(resultIngredients7).toEqual(guessOnlyIngredients.ingredients?.sort());
  });

  it("should return null when creating a guess for a day that doesn't exist", async () => {
    const day0Id = "random-cuid";
    const dayRecord1 = await prisma.day.findFirst({ where: { id: day0Id } });
    const result1 = await createTeaGuess(testUser.id, day0Id, guessComplete1, TEST_POINTS);
    
    expect(dayRecord1).toBeNull();
    expect(result1).toBeNull();
  });

  it("should retrieve the last guess correctly", async () => {
    await createTeaGuess(testUser.id, testDay1.id, guessComplete1, TEST_POINTS);
    await new Promise(resolve => setTimeout(resolve, 500));
    await createTeaGuess(testUser.id, testDay1.id, guessComplete2, TEST_POINTS);

    const result = await getLastGuess(testUser.id, testDay1.id);
    expect(result).toBeDefined();
    expect(result?.userId).toBe(testUser.id);
    expect(result?.dayId).toBe(testDay1.id);
    expect(result?.guessedUserId).toBeNull();
    expect(result?.guessedGuestName).toBe(guessComplete2.personName);
    expect(result?.guessedTeaName).toBe(guessComplete2.teaName);
    expect(result?.guessedTeaType).toBe(guessComplete2.teaType);
    const resultIngredients = result?.guessedIngredients.map(ingredient => ingredient.id).sort();
    expect(resultIngredients).toEqual(guessComplete2.ingredients?.sort());
    // Better way to check arrays
    expect(result?.guessedIngredients.map(i => i.id)).toEqual(
      expect.arrayContaining(guessComplete2.ingredients!)
    );
    expect(result?.guessedIngredients).toHaveLength(guessComplete2.ingredients!.length);
  });

  it("should retrieve all guesses correctly", async () => {
    const result1 = await createTeaGuess(testUser.id, testDay1.id, guessComplete1, TEST_POINTS);
    await new Promise(resolve => setTimeout(resolve, 500));
    const result2 = await createTeaGuess(testUser.id, testDay1.id, guessComplete2, TEST_POINTS);
    await new Promise(resolve => setTimeout(resolve, 200));
    const result3 = await createTeaGuess(testUser.id, testDay1.id, guessOnlyIngredients, TEST_POINTS);

    const resultGuesses = await getAllGuesses(testUser.id, testDay1.id);
    expect(resultGuesses).toHaveLength(3);
    expect(result1).toBeDefined();
    expect(resultGuesses[2].id).toEqual(result1?.id);
    expect(result2).toBeDefined();
    expect(resultGuesses[1].id).toEqual(result2?.id);
    expect(result3).toBeDefined();
    expect(resultGuesses[0].id).toEqual(result3?.id);
  });
});

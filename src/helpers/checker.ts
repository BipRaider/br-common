export class Checker {
  constructor() {}

  /*** Check mongodb `ObjectId`. */
  public isObjectId = (id: string): boolean => {
    let checkForValidMongoDbID = new RegExp('^[0-9a-fA-F]{24}$');

    return checkForValidMongoDbID.test(id);
  };
}
